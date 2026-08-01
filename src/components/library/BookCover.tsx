import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { openLibraryCoverUrl } from '../../services/bookLookup';
import { isSupportedBookCoverUrl } from '../../services/bookCoverPolicy';
import type { Book } from '../../types/book';

type CoverBook = Pick<
  Book,
  'title' | 'kind' | 'isbn' | 'coverUrl' | 'coverLocalUri'
>;

interface Props {
  book: CoverBook;
  width?: number;
  height?: number;
  borderRadius?: number;
  imageStyle?: StyleProp<ImageStyle>;
  placeholderStyle?: StyleProp<ViewStyle>;
  onRemoteLoaded?: (url: string) => void;
  onLocalMissing?: () => void;
}

/** 端末保存画像 → 同期URL → ISBN直引きの順で、安全にフォールバック表示する。 */
export function BookCover({
  book,
  width = 60,
  height = 80,
  borderRadius = 8,
  imageStyle,
  placeholderStyle,
  onRemoteLoaded,
  onLocalMissing,
}: Props) {
  const candidates = useMemo(
    () => Array.from(new Set([
      book.coverLocalUri,
      book.coverUrl && isSupportedBookCoverUrl(book.coverUrl) ? book.coverUrl : undefined,
      book.kind === 'paper' && book.isbn ? openLibraryCoverUrl(book.isbn) : undefined,
    ].filter((url): url is string => Boolean(url)))),
    [book.coverLocalUri, book.coverUrl, book.isbn, book.kind],
  );
  const candidateKey = candidates.join('|');
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidateKey]);

  const candidate = candidates[candidateIndex];
  if (candidate) {
    const local = candidate === book.coverLocalUri;
    return (
      <Image
        source={{ uri: candidate }}
        style={[
          styles.image,
          { width, height, borderRadius },
          imageStyle,
        ]}
        resizeMode="cover"
        onLoad={() => {
          if (!local) onRemoteLoaded?.(candidate);
        }}
        onError={() => {
          if (local) onLocalMissing?.();
          setCandidateIndex((index) => index + 1);
        }}
        accessibilityLabel={`${book.title}の表紙`}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        book.kind === 'paper' ? styles.paper : styles.content,
        { width, height, borderRadius },
        placeholderStyle,
      ]}
      accessibilityLabel={`${book.title}の表紙画像は未登録です`}
    >
      {book.kind === 'paper' ? (
        <Text style={styles.spine} numberOfLines={4}>{book.title}</Text>
      ) : (
        <Text style={styles.initial}>{book.title.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: COLORS.cardElevated },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  paper: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 4,
  },
  content: { backgroundColor: COLORS.accentDim },
  spine: {
    color: COLORS.mutedLight,
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
  initial: { color: COLORS.accent, fontSize: 28, fontWeight: '700' },
});
