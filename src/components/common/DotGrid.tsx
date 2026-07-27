import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  filled: number;
  total: number;
  /** 1行あたりのマス数。100冊は 10×10 で原稿用紙の升目と同型になる。 */
  perRow?: number;
}

/**
 * 100冊のマス目。
 *
 * react-native-svg は入れない——進捗の装飾のために新規ネイティブ依存を
 * 足す価値はないので、プレーンな View で組む。
 */
export function DotGrid({ filled, total, perRow = 10 }: Props) {
  const cells = Array.from({ length: total }, (_, i) => i);

  return (
    <View style={styles.grid}>
      {cells.map((i) => {
        const isFilled = i < filled;
        const isNext = i === filled;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              { width: `${100 / perRow}%` },
              isFilled && styles.filled,
              isNext && styles.next,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dot: {
    aspectRatio: 1,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 2,
    // 隙間はマス自体の縁で作る（gap だと % 幅と噛み合わない）。
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  filled: { backgroundColor: COLORS.accent },
  next: { backgroundColor: 'transparent', borderColor: COLORS.shu, borderWidth: 1.5 },
});
