import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { COLORS } from '../constants/colors';
import { persistDogEarImage, removeManagedDogEarImage } from '../services/dogEarImage';
import { normalizeIncomingShare } from '../services/incomingShare';
import { useLibraryStore } from '../store/libraryStore';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export default function HandleShareScreen() {
  const router = useRouter();
  const books = useLibraryStore((state) => state.books);
  const addDogEar = useLibraryStore((state) => state.addDogEar);
  const addLink = useLibraryStore((state) => state.addLink);
  const {
    sharedPayloads,
    resolvedSharedPayloads,
    clearSharedPayloads,
    isResolving,
    error,
  } = useIncomingShare();
  const draft = useMemo(
    () => normalizeIncomingShare(sharedPayloads, resolvedSharedPayloads),
    [sharedPayloads, resolvedSharedPayloads],
  );
  const [bookId, setBookId] = useState('');
  const [quote, setQuote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId && books[0]) setBookId(books[0].id);
  }, [bookId, books]);
  useEffect(() => {
    setQuote(draft?.quote ?? '');
  }, [draft?.quote, draft?.image?.uri]);

  const close = () => {
    clearSharedPayloads();
    router.replace('/shelf');
  };

  const save = async () => {
    if (!draft || saving) return;
    const book = books.find((item) => item.id === bookId);
    if (!book) {
      setSaveError('保存先の本を選んでください。');
      return;
    }
    const text = quote.trim();
    if ((draft.image || !draft.url) && !text) {
      setSaveError(draft.image ? '画像の説明または抜き書きを入力してください。' : '抜き書きを入力してください。');
      return;
    }
    if (draft.image?.size && draft.image.size > MAX_IMAGE_BYTES) {
      setSaveError('画像は12MB以下にしてください。');
      return;
    }

    setSaving(true);
    setSaveError(null);
    const now = Date.now();
    const dogEarId = `de_${now}_${Math.random().toString(36).slice(2, 8)}`;
    let persistedPhoto: string | undefined;
    try {
      if (draft.image) {
        persistedPhoto = await persistDogEarImage(
          {
            uri: draft.image.uri,
            fileName: draft.image.fileName,
            mimeType: draft.image.mimeType,
          },
          dogEarId,
        );
      }
      if (text || persistedPhoto) {
        addDogEar(book.id, {
          id: dogEarId,
          page: 0,
          quote: text,
          photoUri: persistedPhoto,
          createdAt: now,
        });
      }
      if (draft.url) {
        addLink(book.id, {
          id: `link_${now}_${Math.random().toString(36).slice(2, 8)}`,
          label: draft.linkLabel ?? '共有リンク',
          url: draft.url,
          kind: 'other',
          createdAt: now,
        });
      }
      clearSharedPayloads();
      router.replace({ pathname: '/note/[id]', params: { id: book.id } });
    } catch (caught) {
      if (persistedPhoto) removeManagedDogEarImage(persistedPhoto);
      setSaveError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="READING NOTEへ保存" onBack={close} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isResolving ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.statusText}>共有内容を読み込んでいます…</Text>
          </View>
        ) : error ? (
          <Text style={styles.error} accessibilityRole="alert">共有内容を読み取れませんでした。{error.message}</Text>
        ) : !draft ? (
          <Text style={styles.error} accessibilityRole="alert">保存できるテキスト・URL・画像がありません。</Text>
        ) : (
          <>
            <View>
              <Text style={styles.label}>保存先の本</Text>
              {books.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.help}>先に本棚へ本を1冊登録してください。共有内容は戻るまで保持されます。</Text>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => router.push('/book/new')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryText}>本を登録する</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.bookList}>
                  {books.map((book) => {
                    const selected = book.id === bookId;
                    return (
                      <TouchableOpacity
                        key={book.id}
                        style={[styles.bookButton, selected && styles.bookButtonSelected]}
                        onPress={() => setBookId(book.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.bookTitle, selected && styles.bookTitleSelected]} numberOfLines={2}>
                          {book.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {draft.image && (
              <Image
                source={{ uri: draft.image.uri }}
                style={styles.preview}
                resizeMode="contain"
                accessible
                accessibilityLabel="共有された画像"
              />
            )}

            <View>
              <Text style={styles.label}>{draft.image ? '画像の説明・抜き書き' : '抜き書き（任意）'}</Text>
              <TextInput
                value={quote}
                onChangeText={setQuote}
                style={styles.input}
                placeholder={draft.image ? '図やグラフの要点を書く' : '共有された文章'}
                placeholderTextColor={COLORS.muted}
                multiline
                textAlignVertical="top"
              />
            </View>

            {draft.url && (
              <View style={styles.urlCard}>
                <Text style={styles.label}>同時に保存するリンク</Text>
                <Text style={styles.url} numberOfLines={3}>{draft.url}</Text>
              </View>
            )}
          </>
        )}

        {saveError && <Text style={styles.error} accessibilityRole="alert">{saveError}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, (!draft || books.length === 0 || saving) && styles.disabled]}
          disabled={!draft || books.length === 0 || saving}
          onPress={() => void save()}
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color={COLORS.onAccent} /> : <Text style={styles.primaryText}>選んだ本に保存</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 20, gap: 20, paddingBottom: 32 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 },
  statusText: { color: COLORS.mutedLight, fontSize: 14 },
  label: { color: COLORS.mutedLight, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  help: { color: COLORS.mutedLight, fontSize: 13, lineHeight: 20 },
  emptyCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, gap: 12 },
  bookList: { gap: 8 },
  bookButton: { minHeight: 48, justifyContent: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  bookButtonSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  bookTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  bookTitleSelected: { color: COLORS.accent },
  preview: { width: '100%', height: 260, backgroundColor: COLORS.cardElevated, borderRadius: 12 },
  input: { minHeight: 120, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, color: COLORS.text, fontSize: 15, lineHeight: 23 },
  urlCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12 },
  url: { color: COLORS.accent, fontSize: 13, lineHeight: 19 },
  error: { color: COLORS.danger, fontSize: 13, lineHeight: 20 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.shu, borderRadius: 12 },
  primaryText: { color: COLORS.onAccent, fontSize: 15, fontWeight: '700' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.accent, borderRadius: 10 },
  secondaryText: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
