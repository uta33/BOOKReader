import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  currentIdx: number;
  total: number;
  currentPage: number;
  totalPages: number;
}

export function PageIndicator({ currentIdx, total, currentPage, totalPages }: Props) {
  const percent = total > 0 ? Math.round((currentIdx / total) * 100) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.label}>
        {currentPage} / {totalPages}ページ · {percent}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingVertical: 10 },
  progressBg: {
    height: 2,
    backgroundColor: COLORS.border,
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
  },
  label: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
