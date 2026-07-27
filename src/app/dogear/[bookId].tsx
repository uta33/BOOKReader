import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { QUOTE_TEXT } from '../../constants/typography';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useLibraryStore } from '../../store/libraryStore';

export default function DogEarScreen() {
  const router = useRouter();
  const { bookId, dogEarId } = useLocalSearchParams<{ bookId: string; dogEarId?: string }>();
  const books = useLibraryStore((s) => s.books);
  const addDogEar = useLibraryStore((s) => s.addDogEar);
  const updateDogEar = useLibraryStore((s) => s.updateDogEar);
  const removeDogEar = useLibraryStore((s) => s.removeDogEar);

  const book = books.find((b) => b.id === bookId);
  const existing = dogEarId ? book?.dogEars.find((d) => d.id === dogEarId) : undefined;

  // すべてローカル state。保存を押したときだけストアに書く。
  const [page, setPage] = useState(existing?.page ? String(existing.page) : '');
  const [line, setLine] = useState(existing?.line != null ? String(existing.line) : '');
  const [quote, setQuote] = useState(existing?.quote ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');

  if (!book) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader onBack={() => router.back()} />
        <Text style={styles.missing}>本が見つかりません</Text>
      </SafeAreaView>
    );
  }

  const canSave = quote.trim().length > 0;

  const onSave = () => {
    if (!canSave) return;
    const parsedPage = Number.parseInt(page, 10);
    const parsedLine = Number.parseInt(line, 10);
    const fields = {
      page: Number.isFinite(parsedPage) ? Math.max(0, parsedPage) : 0,
      line: Number.isFinite(parsedLine) ? Math.max(1, parsedLine) : undefined,
      quote: quote.trim(),
      comment: comment.trim() || undefined,
    };

    if (existing) {
      updateDogEar(book.id, existing.id, fields);
    } else {
      addDogEar(book.id, {
        id: `de_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        ...fields,
      });
    }
    router.back();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('この抜き書きを削除', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          removeDogEar(book.id, existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="抜き書き"
        onBack={() => router.back()}
        right={
          existing ? (
            <TouchableOpacity onPress={onDelete} hitSlop={10}>
              <Text style={styles.delete}>削除</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.bookLine} numberOfLines={1}>
            {book.title}
            {book.author ? ` · ${book.author}` : ''}
          </Text>

          <View style={styles.plRow}>
            <View style={styles.flex}>
              <Text style={styles.label}>P — ページ</Text>
              <TextInput
                style={[styles.input, styles.number]}
                value={page}
                onChangeText={(t) => setPage(t.replace(/[^0-9]/g, ''))}
                placeholder="—"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>L — 行（任意）</Text>
              <TextInput
                style={[styles.input, styles.number]}
                value={line}
                onChangeText={(t) => setLine(t.replace(/[^0-9]/g, ''))}
                placeholder="—"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>
              抜き書き<Text style={styles.required}> ✳︎</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.genko]}
              value={quote}
              onChangeText={setQuote}
              placeholder="線を引いた箇所を書き写す"
              placeholderTextColor={COLORS.muted}
              multiline
              textAlignVertical="top"
              autoFocus={!existing}
            />
          </View>

          <View>
            <Text style={styles.label}>コメント（なぜ折ったか）</Text>
            <TextInput
              style={[styles.input, styles.commentInput]}
              value={comment}
              onChangeText={setComment}
              placeholder="思ったこと"
              placeholderTextColor={COLORS.muted}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Text style={styles.helper}>
            折ったページの角を開いて、
            <Text style={styles.helperStrong}>線を引いた箇所をそのまま書き写す</Text>。
            写している間に頭に入る——それがこの仕組みの狙いです。
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.disabled]}
            onPress={onSave}
            disabled={!canSave}
          >
            <Text style={styles.saveText}>保存する</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  missing: { color: COLORS.text, padding: 20 },
  delete: { color: COLORS.shu, fontSize: 13.5, fontWeight: '700' },

  body: { padding: 20, gap: 18, paddingBottom: 32 },
  bookLine: { color: COLORS.muted, fontSize: 12 },

  plRow: { flexDirection: 'row', gap: 12 },
  label: { color: COLORS.muted, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  required: { color: COLORS.shu },

  input: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.text,
    fontSize: 15,
  },
  number: {
    ...QUOTE_TEXT,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  genko: { ...QUOTE_TEXT, color: COLORS.text, minHeight: 150 },
  commentInput: { minHeight: 70, fontSize: 14 },

  helper: { color: COLORS.muted, fontSize: 11.5, lineHeight: 19 },
  helperStrong: { color: COLORS.shu, fontWeight: '700' },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveBtn: { backgroundColor: COLORS.shu, borderRadius: 12, paddingVertical: 14 },
  saveText: { color: COLORS.onAccent, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.4 },
});
