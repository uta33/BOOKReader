import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { PURPOSES } from '../../constants/purposes';
import {
  BOOKS_PER_MONTH,
  BOOKS_PER_PURPOSE,
  BOOKS_PER_VOLUME,
  GOAL_TOTAL_BOOKS,
} from '../../constants/readingNote';
import { DotGrid } from '../../components/common/DotGrid';
import { StatBar } from '../../components/common/StatBar';
import {
  finishedBooks,
  finishedThisMonth,
  notePosition,
  purposeProgress,
} from '../../services/readingProgress';
import { useLibraryStore } from '../../store/libraryStore';

export default function ProgressScreen() {
  const router = useRouter();
  const books = useLibraryStore((s) => s.books);

  // すべて books の純関数。保存する状態はない。
  const stats = useMemo(() => {
    const done = finishedBooks(books).length;
    return {
      done,
      thisMonth: finishedThisMonth(books, new Date()),
      // 「いま何冊目のノートの何ページ目まで埋まったか」を示す。
      spread: notePosition(Math.max(0, done - 1)),
      byPurpose: purposeProgress(books),
      remaining: Math.max(0, GOAL_TOTAL_BOOKS - done),
    };
  }, [books]);

  const inVolume = stats.done === 0 ? 0 : stats.spread.page;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>進捗</Text>
        <TouchableOpacity onPress={() => router.push('/milestone')} hitSlop={8}>
          <Text style={styles.headerAction}>棚卸し ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.big}>
              {stats.done}
              <Text style={styles.bigUnit}> / {GOAL_TOTAL_BOOKS}冊</Text>
            </Text>
            <Text style={styles.sub}>
              NOTE {stats.spread.volume}冊目 · {inVolume} / {BOOKS_PER_VOLUME}ページ
            </Text>
          </View>

          <DotGrid filled={stats.done} total={GOAL_TOTAL_BOOKS} />

          <View style={styles.gridCap}>
            <Text style={styles.capText}>1マス＝1冊</Text>
            <Text style={styles.capText}>あと {stats.remaining}冊</Text>
          </View>
        </View>

        <View style={styles.block}>
          <StatBar
            label="今月のペース"
            value={stats.thisMonth}
            target={BOOKS_PER_MONTH}
            emphasis
          />
          <Text style={styles.note}>
            月{BOOKS_PER_MONTH}冊なら半年で1ノート（{BOOKS_PER_VOLUME}冊）が埋まります
          </Text>
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>10の目的</Text>
            <Text style={styles.capText}>各 {BOOKS_PER_PURPOSE}冊</Text>
          </View>

          {PURPOSES.map((p) => {
            const n = stats.byPurpose[p.id];
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.purposeRow}
                onPress={() =>
                  router.push({ pathname: '/shelf', params: { purpose: p.id } })
                }
              >
                <Text style={styles.purposeEmoji}>{p.emoji}</Text>
                <Text style={styles.purposeLabel} numberOfLines={1}>{p.label}</Text>
                <View style={styles.purposeBar}>
                  <StatBar value={n} target={BOOKS_PER_PURPOSE} compact />
                </View>
                <Text style={styles.purposeCount}>
                  {n}/{BOOKS_PER_PURPOSE}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  headerAction: { color: COLORS.accent, fontSize: 13.5, fontWeight: '700' },

  body: { padding: 16, gap: 14, paddingBottom: 32 },
  block: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  blockHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  big: { color: COLORS.text, fontSize: 26, fontWeight: '800' },
  bigUnit: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  sub: { color: COLORS.muted, fontSize: 12 },
  sectionTitle: { color: COLORS.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  note: { color: COLORS.muted, fontSize: 11.5, lineHeight: 18 },

  gridCap: { flexDirection: 'row', justifyContent: 'space-between' },
  capText: { color: COLORS.muted, fontSize: 11 },

  purposeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  purposeEmoji: { fontSize: 14, width: 20 },
  purposeLabel: { color: COLORS.text, fontSize: 12.5, flex: 1 },
  purposeBar: { width: 70 },
  purposeCount: { color: COLORS.muted, fontSize: 11, width: 38, textAlign: 'right' },
});
