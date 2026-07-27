import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { PURPOSES, type PurposeId } from '../../constants/purposes';
import { createPaperBook } from '../../services/bookFactory';
import { lookupIsbn } from '../../services/bookLookup';
import { normalizeIsbn } from '../../services/isbn';
import { useLibraryStore } from '../../store/libraryStore';

export default function NewBookScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ isbn?: string }>();
  const books = useLibraryStore((s) => s.books);
  const addBook = useLibraryStore((s) => s.addBook);

  const scannedIsbn = useMemo(
    () => (params.isbn ? normalizeIsbn(params.isbn) : null),
    [params.isbn],
  );

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [pages, setPages] = useState('');
  const [bookstore, setBookstore] = useState('');
  const [purposes, setPurposes] = useState<PurposeId[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | undefined>();
  const [pubdate, setPubdate] = useState<string | undefined>();

  const [looking, setLooking] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);

  // すでに本棚にある本を二重に登録させない。
  const duplicate = useMemo(
    () => (scannedIsbn ? books.find((b) => b.isbn === scannedIsbn) : undefined),
    [books, scannedIsbn],
  );

  useEffect(() => {
    if (!scannedIsbn || duplicate) return;
    const controller = new AbortController();
    let alive = true;

    setLooking(true);
    setLookupNote(null);
    lookupIsbn(scannedIsbn, controller.signal)
      .then((hit) => {
        if (!alive) return;
        if (!hit) {
          setLookupNote('書誌情報が見つかりませんでした。手で入力してください。');
          return;
        }
        setTitle((v) => v || hit.title);
        setAuthor((v) => v || hit.author || '');
        setPublisher((v) => v || hit.publisher || '');
        setCoverUrl(hit.coverUrl);
        setPubdate(hit.pubdate);
        setLookupNote(
          hit.source === 'openbd' ? 'openBD から取得しました' : '国立国会図書館サーチから取得しました',
        );
      })
      .finally(() => {
        if (alive) setLooking(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [scannedIsbn, duplicate]);

  const togglePurpose = (id: PurposeId) =>
    setPurposes((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const canSave = title.trim().length > 0;

  const onSave = () => {
    if (!canSave) return;
    const parsedPages = Number.parseInt(pages, 10);
    const book = createPaperBook({
      title: title.trim(),
      author: author.trim() || undefined,
      publisher: publisher.trim() || undefined,
      bookstore: bookstore.trim() || undefined,
      totalPages: Number.isFinite(parsedPages) ? parsedPages : 0,
      isbn: scannedIsbn ?? undefined,
      coverUrl,
      pubdate,
      purposes,
    });
    addBook(book);
    router.replace({ pathname: '/note/[id]', params: { id: book.id } });
  };

  if (duplicate) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} title="紙の本を登録" />
        <View style={styles.center}>
          <Text style={styles.dupTitle}>すでに本棚にあります</Text>
          <Text style={styles.dupBody}>「{duplicate.title}」は登録済みです。</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              router.replace({ pathname: '/note/[id]', params: { id: duplicate.id } })
            }
          >
            <Text style={styles.primaryBtnText}>ノートを開く</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => router.replace('/')}>
            <Text style={styles.ghostBtnText}>本棚へ戻る</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={() => router.back()} title="紙の本を登録" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {scannedIsbn && (
            <View style={styles.isbnCard}>
              <View style={styles.isbnRow}>
                <Text style={styles.isbnLabel}>ISBN</Text>
                <Text style={styles.isbnValue}>{scannedIsbn}</Text>
              </View>
              {looking ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.hint}>書誌情報を照会しています…</Text>
                </View>
              ) : (
                lookupNote && <Text style={styles.hint}>{lookupNote}</Text>
              )}
            </View>
          )}

          <Field label="タイトル" required>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="本のタイトル"
              placeholderTextColor={COLORS.muted}
              autoFocus={!scannedIsbn}
            />
          </Field>

          <Field label="著者">
            <TextInput
              style={styles.input}
              value={author}
              onChangeText={setAuthor}
              placeholder="著者名"
              placeholderTextColor={COLORS.muted}
            />
          </Field>

          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="出版社">
                <TextInput
                  style={styles.input}
                  value={publisher}
                  onChangeText={setPublisher}
                  placeholder="出版社"
                  placeholderTextColor={COLORS.muted}
                />
              </Field>
            </View>
            <View style={styles.pagesCol}>
              <Field label="ページ数">
                <TextInput
                  style={styles.input}
                  value={pages}
                  onChangeText={(t) => setPages(t.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="number-pad"
                />
              </Field>
            </View>
          </View>

          <Field label="出会った書店">
            <TextInput
              style={styles.input}
              value={bookstore}
              onChangeText={setBookstore}
              placeholder="どこで手に入れたか"
              placeholderTextColor={COLORS.muted}
            />
          </Field>

          <Field label="この本を読む目的">
            <View style={styles.chips}>
              {PURPOSES.map((p) => {
                const on = purposes.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => togglePurpose(p.id)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {p.emoji} {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, !canSave && styles.btnDisabled]}
            onPress={onSave}
            disabled={!canSave}
          >
            <Text style={styles.primaryBtnText}>本棚に登録する</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}> ✳︎</Text>}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  back: { color: COLORS.accent, fontSize: 26, lineHeight: 28 },
  headerTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },

  body: { padding: 20, gap: 18, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  isbnCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 8,
  },
  isbnRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  isbnLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  isbnValue: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { color: COLORS.mutedLight, fontSize: 12.5, lineHeight: 19 },

  field: { gap: 6 },
  fieldLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  required: { color: COLORS.danger },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.text,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 12 },
  pagesCol: { width: 110 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
  chipText: { color: COLORS.muted, fontSize: 12.5 },
  chipTextOn: { color: COLORS.accentBright, fontWeight: '700' },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    color: COLORS.onAccent,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  ghostBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  ghostBtnText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },

  dupTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  dupBody: { color: COLORS.mutedLight, fontSize: 14, textAlign: 'center', marginBottom: 8 },
});
