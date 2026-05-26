import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { Book } from '../../types/book';

interface Props {
  book: Book;
  isLastOpened?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export function BookCard({ book, isLastOpened, onPress, onLongPress }: Props) {
  const progress = book.sentences.length > 0
    ? book.lastSentenceIdx / book.sentences.length
    : 0;
  const percent = Math.round(progress * 100);
  const cached = book.cachedSentenceIds.length;
  const total = book.sentences.length;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, isLastOpened && styles.cardActive]}
      activeOpacity={0.75}
    >
      <View style={styles.cover}>
        <Text style={styles.coverInitial}>
          {book.title.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.meta}>{total}文 · {book.totalPages}ページ</Text>

        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.percentText}>{percent}%</Text>
        </View>

        {cached >= total && total > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ キャッシュ済</Text>
          </View>
        )}
      </View>

      {isLastOpened && (
        <View style={styles.activeDot} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardActive: {
    borderColor: COLORS.accent,
  },
  cover: {
    width: 60,
    height: 80,
    borderRadius: 8,
    backgroundColor: COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  coverInitial: {
    fontSize: 28,
    color: COLORS.accent,
    fontWeight: '700',
  },
  info: { flex: 1 },
  title: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 21,
  },
  meta: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 10,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBg: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  percentText: {
    color: COLORS.muted,
    fontSize: 11,
    width: 32,
    textAlign: 'right',
  },
  badge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(60,180,100,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: '#4CAF81',
    fontSize: 11,
    fontWeight: '600',
  },
  activeDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
});
