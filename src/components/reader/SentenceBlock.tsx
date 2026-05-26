import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  text: string;
  isActive: boolean;
  onPress: () => void;
}

export function SentenceBlock({ text, isActive, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.block, isActive && styles.blockActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, isActive && styles.textActive]}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 3,
  },
  blockActive: {
    backgroundColor: COLORS.highlight,
  },
  text: {
    color: COLORS.mutedLight,
    fontSize: 17,
    lineHeight: 30,
  },
  textActive: {
    color: COLORS.white,
    fontWeight: '500',
  },
});
