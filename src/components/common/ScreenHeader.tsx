import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  title?: string;
  onBack?: () => void;
  /** 右端に置く要素（⋯ メニューや削除など）。 */
  right?: React.ReactNode;
  /** 下の境界線を出さない。 */
  flush?: boolean;
}

export function ScreenHeader({ title, onBack, right, flush }: Props) {
  return (
    <View style={[styles.header, !flush && styles.bordered]}>
      {onBack && (
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
      )}
      {title != null && <Text style={styles.title}>{title}</Text>}
      <View style={styles.spacer} />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  bordered: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { color: COLORS.accent, fontSize: 26, lineHeight: 28 },
  title: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  spacer: { flex: 1 },
});
