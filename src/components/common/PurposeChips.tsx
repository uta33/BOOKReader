import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { PURPOSES, type PurposeId } from '../../constants/purposes';

interface Props {
  selected: PurposeId[];
  /** 省略すると読み取り専用になり、選択済みだけを表示する。 */
  onToggle?: (id: PurposeId) => void;
}

export function PurposeChips({ selected, onToggle }: Props) {
  const items = onToggle ? PURPOSES : PURPOSES.filter((p) => selected.includes(p.id));
  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {items.map((p) => {
        const on = selected.includes(p.id);
        const content = (
          <Text style={[styles.text, on && styles.textOn]}>
            {p.emoji} {p.label}
          </Text>
        );
        return onToggle ? (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onToggle(p.id)}
          >
            {content}
          </TouchableOpacity>
        ) : (
          <View key={p.id} style={[styles.chip, styles.chipOn]}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
  text: { color: COLORS.muted, fontSize: 12.5 },
  textOn: { color: COLORS.accentBright, fontWeight: '700' },
});
