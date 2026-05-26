import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  onImport: () => void;
}

export function EmptyLibrary({ onImport }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📚</Text>
      <Text style={styles.title}>まだ本がありません</Text>
      <Text style={styles.subtitle}>
PDFをインポートすると、音声で読み上げてくれます。
      </Text>
      <TouchableOpacity onPress={onImport} style={styles.btn}>
        <Text style={styles.btnText}>PDFを追加</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emoji: { fontSize: 64 },
  title: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  btnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
