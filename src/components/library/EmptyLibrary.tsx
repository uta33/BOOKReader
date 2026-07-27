import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  onScan: () => void;
  onImport: () => void;
}

export function EmptyLibrary({ onScan, onImport }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📕</Text>
      <Text style={styles.title}>最初の一冊から</Text>
      <Text style={styles.subtitle}>
        手元の本のバーコードを読み取ると、書名を引いてノートを作ります。
        折ったページの抜き書きが、ここに溜まっていきます。
      </Text>
      <TouchableOpacity onPress={onScan} style={styles.btn}>
        <Text style={styles.btnText}>紙の本を登録</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onImport} style={styles.ghost}>
        <Text style={styles.ghostText}>ファイルを取り込む</Text>
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
    color: COLORS.text,
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
    color: COLORS.onAccent,
    fontWeight: '700',
    fontSize: 16,
  },
  ghost: { paddingHorizontal: 20, paddingVertical: 8 },
  ghostText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
});
