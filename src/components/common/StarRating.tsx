import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  value?: number;
  /** 省略すると読み取り専用。 */
  onChange?: (value: number) => void;
  /** 藍の帯の上に置くとき。 */
  onAccent?: boolean;
}

const STARS = [1, 2, 3, 4, 5];

export function StarRating({ value = 0, onChange, onAccent }: Props) {
  return (
    <View style={styles.row}>
      {STARS.map((n) => {
        const filled = n <= value;
        const star = (
          <Text
            style={[
              styles.star,
              onAccent
                ? filled
                  ? styles.filledOnAccent
                  : styles.emptyOnAccent
                : filled
                  ? styles.filled
                  : styles.empty,
            ]}
          >
            {filled ? '★' : '☆'}
          </Text>
        );
        return onChange ? (
          <TouchableOpacity
            key={n}
            hitSlop={6}
            // 同じ星をもう一度押したら評価を取り消す。
            onPress={() => onChange(value === n ? 0 : n)}
          >
            {star}
          </TouchableOpacity>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 16 },
  filled: { color: COLORS.accent },
  empty: { color: COLORS.border },
  filledOnAccent: { color: COLORS.onAccent },
  emptyOnAccent: { color: 'rgba(246,247,243,0.45)' },
});
