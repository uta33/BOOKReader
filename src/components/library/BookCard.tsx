import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { purposeLabel } from '../../constants/purposes';
import { Book } from '../../types/book';

interface Props {
  book: Book;
  isLastOpened?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export function BookCard({ book, isLastOpened, onPress, onLongPress }: Props) {
  const isPaper = book.kind === 'paper';

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, isLastOpened && styles.cardActive]}
      activeOpacity={0.75}
    >
      <Cover book={book} />

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
        {isPaper ? <PaperMeta book={book} /> : <ContentMeta book={book} />}
      </View>

      {isLastOpened && <View style={styles.activeDot} />}
    </TouchableOpacity>
  );
}

function Cover({ book }: { book: Book }) {
  if (book.coverUrl) {
    return <Image source={{ uri: book.coverUrl }} style={styles.coverImage} resizeMode="cover" />;
  }
  if (book.kind === 'paper') {
    // 書影が引けない本も多いので、背表紙として組む。
    return (
      <View style={[styles.cover, styles.coverPaper]}>
        <Text style={styles.coverSpine} numberOfLines={4}>{book.title}</Text>
      </View>
    );
  }
  return (
    <View style={styles.cover}>
      <Text style={styles.coverInitial}>{book.title.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/** 紙の本には読み上げ進捗が無いので、抜き書きの蓄積を出す。 */
function PaperMeta({ book }: { book: Book }) {
  const dogEars = book.dogEars?.length ?? 0;
  const links = book.links?.length ?? 0;
  const purposes = book.purposes ?? [];
  const sub = [book.author, book.totalPages ? `${book.totalPages}ページ` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {sub.length > 0 && <Text style={styles.meta} numberOfLines={1}>{sub}</Text>}
      <Text style={styles.stats}>
        {dogEars > 0 ? (
          <>
            抜き書き <Text style={styles.statsStrong}>{dogEars}</Text>
            {links > 0 ? `　リンク ${links}` : ''}
          </>
        ) : (
          <Text style={styles.statsMuted}>まだ抜き書きがありません</Text>
        )}
      </Text>

      <View style={styles.badgeRow}>
        {book.finishedAt != null && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ 読了</Text>
          </View>
        )}
        {purposes.slice(0, 2).map((p) => (
          <View key={p} style={styles.chip}>
            <Text style={styles.chipText}>{purposeLabel(p)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function ContentMeta({ book }: { book: Book }) {
  const total = book.sentences?.length ?? 0;
  const cached = book.cachedSentenceIds?.length ?? 0;
  const percent = total > 0 ? Math.round((book.lastSentenceIdx / total) * 100) : 0;

  return (
    <>
      <Text style={styles.meta}>{total}文 · {book.totalPages ?? 0}ページ</Text>

      <View style={styles.progressRow}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.percentText}>{percent}%</Text>
      </View>

      {cached >= total && total > 0 && (
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ キャッシュ済</Text>
          </View>
        </View>
      )}
    </>
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
  coverImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: COLORS.cardElevated,
  },
  coverPaper: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 4,
  },
  coverSpine: {
    color: COLORS.mutedLight,
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
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
    marginBottom: 8,
  },
  stats: { color: COLORS.mutedLight, fontSize: 12 },
  statsStrong: { color: COLORS.accentBright, fontWeight: '700' },
  statsMuted: { color: COLORS.muted },
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
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
  chip: {
    backgroundColor: COLORS.accentDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: { color: COLORS.accentBright, fontSize: 11 },
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
