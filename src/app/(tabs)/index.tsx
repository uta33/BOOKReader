import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { TITLE_TEXT } from '../../constants/typography';
import { BOOKS_PER_MONTH, GOAL_TOTAL_BOOKS } from '../../constants/readingNote';
import { StatBar } from '../../components/common/StatBar';
import { DogEarRow } from '../../components/note/DogEarRow';
import { finishedBooks, finishedThisMonth } from '../../services/readingProgress';
import { useLibraryStore } from '../../store/libraryStore';
import type { DogEar } from '../../types/book';

/** 3カードに固定して肥大させない。すべて他画面用に作った部品の再利用。 */
export default function HomeScreen() {
  const router = useRouter();
  const books = useLibraryStore((s) => s.books);

  const done = finishedBooks(books).length;
  const thisMonth = finishedThisMonth(books, new Date());

  // 続きから — 読みかけの取り込みコンテンツで、直近のもの。
  const continueBook = useMemo(
    () =>
      books
        .filter((b) => b.kind === 'content' && b.sentences.length > 0)
        .filter((b) => b.lastSentenceIdx < b.sentences.length - 1)
        .sort((a, b) => b.createdAt - a.createdAt)[0],
    [books],
  );

  // 直近の抜き書き3件。どの本のものかも出す。
  const recent = useMemo(() => {
    const all: { dogEar: DogEar; bookId: string; bookTitle: string }[] = [];
    for (const b of books) {
      for (const d of b.dogEars) {
        all.push({ dogEar: d, bookId: b.id, bookTitle: b.title });
      }
    }
    return all.sort((a, b) => b.dogEar.createdAt - a.dogEar.createdAt).slice(0, 3);
  }, [books]);

  if (books.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>READING NOTE</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📕</Text>
          <Text style={styles.emptyTitle}>最初の一冊から</Text>
          <Text style={styles.emptyBody}>
            手元の本のバーコードを読み取ると、書名を引いてノートを作ります。
          </Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.push('/book/scan')}>
            <Text style={styles.ctaText}>紙の本を登録</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>READING NOTE</Text>
        <Text style={styles.headerCount}>
          {done} / {GOAL_TOTAL_BOOKS}冊
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <TouchableOpacity style={styles.block} onPress={() => router.push('/progress')}>
          <StatBar label="今月のペース" value={thisMonth} target={BOOKS_PER_MONTH} emphasis />
          <Text style={styles.note}>タップで進捗を見る</Text>
        </TouchableOpacity>

        {continueBook && (
          <TouchableOpacity
            style={styles.block}
            onPress={() => router.push(`/reader/${continueBook.id}`)}
          >
            <Text style={styles.eyebrow}>続きから聴く</Text>
            <Text style={styles.contTitle} numberOfLines={2}>{continueBook.title}</Text>
            <StatBar
              value={continueBook.lastSentenceIdx + 1}
              target={continueBook.sentences.length}
              compact
            />
          </TouchableOpacity>
        )}

        <View style={styles.block}>
          <Text style={styles.eyebrow}>直近の抜き書き</Text>
          {recent.length === 0 ? (
            <Text style={styles.note}>
              折ったページを開いて、線を引いた箇所を書き写しましょう。
            </Text>
          ) : (
            recent.map(({ dogEar, bookId, bookTitle }) => (
              <View key={dogEar.id} style={styles.recentItem}>
                <Text style={styles.recentBook} numberOfLines={1}>{bookTitle}</Text>
                <DogEarRow
                  dogEar={dogEar}
                  onPress={() => router.push({ pathname: '/note/[id]', params: { id: bookId } })}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  headerCount: { color: COLORS.muted, fontSize: 13 },

  body: { padding: 16, gap: 14, paddingBottom: 32 },
  block: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  eyebrow: { color: COLORS.accent, fontSize: 11.5, fontWeight: '700', letterSpacing: 1 },
  contTitle: { ...TITLE_TEXT, color: COLORS.text, fontWeight: '600' },
  note: { color: COLORS.muted, fontSize: 11.5, lineHeight: 18 },

  recentItem: { gap: 2 },
  recentBook: { color: COLORS.muted, fontSize: 11 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  emptyBody: { color: COLORS.muted, fontSize: 13.5, textAlign: 'center', lineHeight: 21 },
  cta: {
    marginTop: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 26,
    paddingHorizontal: 30,
    paddingVertical: 13,
  },
  ctaText: { color: COLORS.onAccent, fontSize: 15, fontWeight: '700' },
});
