import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { COLORS } from '../../constants/colors';
import { QUOTE_TEXT } from '../../constants/typography';
import type { DogEar } from '../../types/book';

interface Props {
  dogEar: DogEar;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function DogEarRow({ dogEar, onPress, onLongPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      disabled={!onPress && !onLongPress}
    >
      <View style={styles.pl}>
        <Text style={styles.page}>{dogEar.page > 0 ? `P.${dogEar.page}` : '—'}</Text>
        {dogEar.line != null && <Text style={styles.line}>L.{dogEar.line}</Text>}
      </View>

      <View style={styles.body}>
        <Text style={styles.quote}>{dogEar.quote}</Text>
        {dogEar.comment != null && dogEar.comment.length > 0 && (
          <Text style={styles.comment}>{dogEar.comment}</Text>
        )}
        {dogEar.photoUri && (
          <Image
            source={{ uri: dogEar.photoUri }}
            style={styles.photo}
            resizeMode="contain"
            accessible
            accessibilityLabel="抜き書きに添付した図または画像"
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  pl: { width: 54, alignItems: 'flex-end', paddingTop: 1 },
  page: { color: COLORS.shu, fontSize: 13.5, fontWeight: '700' },
  line: { color: COLORS.muted, fontSize: 11 },
  body: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.shuDim,
    paddingLeft: 12,
  },
  quote: { ...QUOTE_TEXT, color: COLORS.text },
  comment: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  photo: {
    width: '100%',
    height: 160,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: COLORS.cardElevated,
  },
});
