import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { COLORS } from '../constants/colors';
import { QUOTE_TEXT } from '../constants/typography';
import { dueDogEars, reviewPatch, type ReviewGrade } from '../services/dogEarReview';
import { useLibraryStore } from '../store/libraryStore';

export default function DailyReviewScreen() {
  const router = useRouter();
  const books = useLibraryStore((state) => state.books);
  const updateDogEar = useLibraryStore((state) => state.updateDogEar);
  const [queue] = useState(() => dueDogEars(books));
  const [index, setIndex] = useState(0);
  const current = queue[index];

  const grade = (value: ReviewGrade) => {
    if (!current) return;
    updateDogEar(current.bookId, current.dogEar.id, reviewPatch(current.dogEar, value));
    setIndex((value) => value + 1);
  };

  if (!current) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="今日のドッグイヤー" onBack={() => router.back()} />
        <View style={styles.complete}>
          <Text style={styles.completeTitle}>今日の復習は完了です</Text>
          <Text style={styles.bodyText}>次の復習日に、また抜き書きが表示されます。</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/')}>
            <Text style={styles.primaryButtonText}>ホームへ戻る</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="今日のドッグイヤー" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.progressRow}>
          <Text style={styles.progress}>{index + 1} / {queue.length}</Text>
          <Text style={styles.bookTitle} numberOfLines={1}>{current.bookTitle}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.location}>
            {current.dogEar.page > 0 ? `P. ${current.dogEar.page}` : 'ページ未指定'}
            {current.dogEar.line ? ` / L. ${current.dogEar.line}` : ''}
          </Text>
          <Text style={styles.quote}>「{current.dogEar.quote}」</Text>
          {current.dogEar.comment && (
            <View style={styles.commentBox}>
              <Text style={styles.commentLabel}>なぜ折ったか</Text>
              <Text style={styles.bodyText}>{current.dogEar.comment}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.noteLink}
            onPress={() => router.push({ pathname: '/note/[id]', params: { id: current.bookId } })}
          >
            <Text style={styles.noteLinkText}>この本のノートを開く</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => grade('again')}
          accessibilityRole="button"
          accessibilityLabel="明日もう一度復習する"
        >
          <Text style={styles.secondaryButtonText}>また見る</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => grade('remembered')}
          accessibilityRole="button"
          accessibilityLabel="覚えたので復習間隔を延ばす"
        >
          <Text style={styles.primaryButtonText}>覚えた</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 20, gap: 14, paddingBottom: 32 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  progress: { color: COLORS.shu, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bookTitle: { flex: 1, color: COLORS.muted, fontSize: 12, textAlign: 'right' },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 20,
    gap: 18,
  },
  location: { color: COLORS.accent, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  quote: { ...QUOTE_TEXT, color: COLORS.text, fontSize: 18, lineHeight: 32 },
  commentBox: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14, gap: 6 },
  commentLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  bodyText: { color: COLORS.mutedLight, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  noteLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  noteLinkText: { color: COLORS.accent, fontSize: 13, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: COLORS.onAccent, fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },
  complete: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 36, gap: 18 },
  completeTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
});
