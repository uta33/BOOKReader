/**
 * 100冊の棚卸し。
 *
 * 進捗タブが「いまどこまで来たか」を示すのに対し、こちらは節目で
 * 「どう来たか」を振り返る画面。ノート1冊＝48冊、月8冊、10の目的×10冊という
 * READING NOTE の設計値に対して、自分の読書がどう偏っているかを見る。
 *
 * 集計はすべて readingProgress の純関数で、AIは使わない。
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';
import { PURPOSES, purposeLabel } from '../constants/purposes';
import {
  BOOKS_PER_MONTH,
  BOOKS_PER_PURPOSE,
  BOOKS_PER_VOLUME,
  GOAL_TOTAL_BOOKS,
} from '../constants/readingNote';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { StatBar } from '../components/common/StatBar';
import {
  currentVolume,
  finishedBooks,
  monthlyPace,
  notePosition,
  purposeBalance,
  volumeBooks,
} from '../services/readingProgress';
import { useLibraryStore } from '../store/libraryStore';

export default function MilestoneScreen() {
  const router = useRouter();
  const books = useLibraryStore((s) => s.books);

  const stats = useMemo(() => {
    const done = finishedBooks(books).length;
    const volume = currentVolume(books);
    return {
      done,
      volume,
      spread: notePosition(Math.max(0, done - 1)),
      inVolume: volumeBooks(books, volume),
      pace: monthlyPace(books, new Date(), 6),
      balance: purposeBalance(books),
    };
  }, [books]);

  const emoji = (id: string) => PURPOSES.find((p) => p.id === id)?.emoji ?? '·';
  const peak = Math.max(BOOKS_PER_MONTH, ...stats.pace.map((m) => m.count));
  const untouched = stats.balance.filter((b) => b.count === 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="棚卸し" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>いまいる場所</Text>
          <Text style={styles.big}>
            {stats.done}
            <Text style={styles.bigUnit}> / {GOAL_TOTAL_BOOKS}冊</Text>
          </Text>
          <Text style={styles.note}>
            NOTE {stats.volume}冊目 · このノートで {stats.inVolume.length} / {BOOKS_PER_VOLUME}冊
          </Text>
          {stats.done === 0 && (
            <Text style={styles.empty}>
              読了にした本がまだありません。マガジンノートで「読了」にすると数えられます。
            </Text>
          )}
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>月ごとのペース</Text>
            <Text style={styles.capText}>目標 月{BOOKS_PER_MONTH}冊</Text>
          </View>
          {stats.pace.map((m) => (
            <View key={m.month} style={styles.paceRow}>
              <Text style={styles.paceMonth}>{m.month}</Text>
              <View style={styles.paceBar}>
                <StatBar value={m.count} target={peak} compact />
              </View>
              <Text style={styles.paceCount}>{m.count}冊</Text>
            </View>
          ))}
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>手薄な目的</Text>
          {untouched.length > 0 ? (
            <Text style={styles.note}>
              まだ1冊も読んでいない目的が {untouched.length}つあります。
            </Text>
          ) : (
            <Text style={styles.note}>10の目的すべてに1冊以上あります。</Text>
          )}
          {stats.balance.slice(0, 5).map((b) => (
            <TouchableOpacity
              key={b.id}
              style={styles.purposeRow}
              onPress={() => router.push({ pathname: '/shelf', params: { purpose: b.id } })}
            >
              <Text style={styles.purposeEmoji}>{emoji(b.id)}</Text>
              <Text style={styles.purposeLabel} numberOfLines={1}>
                {purposeLabel(b.id)}
              </Text>
              <Text style={styles.purposeCount}>
                {b.count}/{BOOKS_PER_PURPOSE}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>このノートで読んだ本</Text>
            <Text style={styles.capText}>{stats.inVolume.length}冊</Text>
          </View>
          {stats.inVolume.length === 0 ? (
            <Text style={styles.empty}>まだありません。</Text>
          ) : (
            stats.inVolume.map((book, idx) => (
              <TouchableOpacity
                key={book.id}
                style={styles.bookRow}
                onPress={() => router.push({ pathname: '/note/[id]', params: { id: book.id } })}
              >
                <Text style={styles.bookNo}>{idx + 1}</Text>
                <Text style={styles.bookTitle} numberOfLines={1}>
                  {book.title}
                </Text>
                <Text style={styles.capText}>
                  {book.dogEars.filter((d) => !d.deletedAt).length}折
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 16, gap: 14, paddingBottom: 32 },
  block: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  blockHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  big: { color: COLORS.text, fontSize: 34, fontWeight: '800' },
  bigUnit: { color: COLORS.muted, fontSize: 15, fontWeight: '700' },
  note: { color: COLORS.muted, fontSize: 12.5, lineHeight: 19 },
  empty: { color: COLORS.muted, fontSize: 12.5, lineHeight: 19 },
  capText: { color: COLORS.muted, fontSize: 11.5 },

  paceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paceMonth: { color: COLORS.muted, fontSize: 12, width: 62 },
  paceBar: { flex: 1 },
  paceCount: { color: COLORS.text, fontSize: 12, width: 34, textAlign: 'right' },

  purposeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  purposeEmoji: { fontSize: 15, width: 22 },
  purposeLabel: { color: COLORS.text, fontSize: 13.5, flex: 1 },
  purposeCount: { color: COLORS.muted, fontSize: 12 },

  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookNo: { color: COLORS.muted, fontSize: 11.5, width: 22, textAlign: 'right' },
  bookTitle: { color: COLORS.text, fontSize: 13.5, flex: 1 },
});
