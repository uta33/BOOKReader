import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { COLORS } from '../../constants/colors';
import type { DigitalLink, LinkKind } from '../../types/book';

const ICONS: Record<LinkKind, string> = {
  notebooklm: '📓',
  claude: '🤖',
  gdocs: '📄',
  other: '🔗',
};

interface Props {
  link: DigitalLink;
  onLongPress?: () => void;
}

export function LinkRow({ link, onLongPress }: Props) {
  const open = async () => {
    try {
      const supported = await Linking.canOpenURL(link.url);
      if (!supported) {
        Alert.alert('開けませんでした', 'このリンクを開けるアプリが見つかりません。');
        return;
      }
      await Linking.openURL(link.url);
    } catch {
      Alert.alert('開けませんでした', 'リンクを開けませんでした。');
    }
  };

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={open}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{ICONS[link.kind] ?? ICONS.other}</Text>
      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1}>{link.label}</Text>
        <Text style={styles.url} numberOfLines={1}>{link.url}</Text>
      </View>
      <Text style={styles.go}>↗</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  icon: { fontSize: 16 },
  body: { flex: 1 },
  label: { color: COLORS.text, fontSize: 13.5 },
  url: { color: COLORS.muted, fontSize: 11, marginTop: 1 },
  go: { color: COLORS.accent, fontSize: 14 },
});
