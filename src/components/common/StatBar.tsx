import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  label?: string;
  value: number;
  target: number;
  /** 朱で塗る（ペースなど注意を向けたいもの）。 */
  emphasis?: boolean;
  /** バーだけを出す（一覧行に埋め込むとき）。 */
  compact?: boolean;
}

export function StatBar({ label, value, target, emphasis, compact }: Props) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

  return (
    <View style={compact ? styles.compact : styles.wrap}>
      {!compact && (
        <View style={styles.head}>
          {label != null && <Text style={styles.label}>{label}</Text>}
          <Text style={styles.value}>
            {value} / {target}
          </Text>
        </View>
      )}
      <View style={styles.track}>
        <View
          style={[styles.fill, emphasis && styles.fillEmphasis, { width: `${pct}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  compact: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  value: { color: COLORS.muted, fontSize: 12 },
  track: {
    height: 5,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: 5, backgroundColor: COLORS.accent, borderRadius: 3 },
  fillEmphasis: { backgroundColor: COLORS.shu },
});
