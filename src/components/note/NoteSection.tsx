import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  title: string;
  /** 見出し右の操作（＋追加など）。 */
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}

export function NoteSection({ title, actionLabel, onAction, children }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} hitSlop={8}>
            <Text style={styles.action}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 5,
  },
  title: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  action: { color: COLORS.shu, fontSize: 12.5, fontWeight: '700' },
});
