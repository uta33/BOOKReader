import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import {
  type CoverCandidate,
  type CoverSource,
} from '../../services/bookLookup';
import { searchAvailableBookCovers } from '../../services/bookCoverSearch';

interface Props {
  isbn?: string;
  title?: string;
  author?: string;
  currentUrl?: string;
  onSelect: (candidate: CoverCandidate) => void | Promise<void>;
}

function sourceLabel(source: CoverSource): string {
  if (source === 'openbd') return 'openBD';
  if (source === 'google-books-isbn') return 'Google Books・ISBN一致';
  if (source === 'google-books-search') return 'Google Books';
  if (source === 'openlibrary-isbn') return 'Open Library・ISBN一致';
  return 'Open Library';
}

export function BookCoverSearch({ isbn, title, author, currentUrl, onSelect }: Props) {
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.abort();
  }, []);

  const search = async () => {
    if (!isbn && !title?.trim()) {
      setError('ISBNまたはタイトルを入力してから検索してください。');
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20_000);
    setSearching(true);
    setCandidates([]);
    setFailedUrls([]);
    setError(null);
    try {
      const found = await searchAvailableBookCovers({ isbn, title, author }, controller.signal);
      if (controller.signal.aborted) return;
      setCandidates(found);
      if (found.length === 0) {
        setError('表紙画像が見つかりませんでした。ISBNと書名を確認してください。');
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : '表紙を検索できませんでした。');
      }
    } finally {
      clearTimeout(timeout);
      if (controllerRef.current === controller) {
        if (timedOut) setError('表紙検索がタイムアウトしました。通信を確認してください。');
        setSearching(false);
      }
    }
  };

  const select = async (candidate: CoverCandidate) => {
    setSavingUrl(candidate.url);
    setError(null);
    try {
      await onSelect(candidate);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '表紙画像を取り込めませんでした。');
    } finally {
      setSavingUrl(null);
    }
  };

  const visibleCandidates = candidates.filter((candidate) => !failedUrls.includes(candidate.url));

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.searchButton, searching && styles.disabled]}
        onPress={() => void search()}
        disabled={searching}
        accessibilityRole="button"
        accessibilityLabel="ISBNと書名から本の表紙を検索"
      >
        <Text style={styles.searchButtonText}>{searching ? '検索中…' : '表紙を検索'}</Text>
      </TouchableOpacity>

      {searching && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={COLORS.accent} />
          <Text style={styles.hint}>openBD・Google Books・Open Libraryを照会しています。</Text>
        </View>
      )}

      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
      )}

      {visibleCandidates.length > 0 && (
        <View style={styles.results}>
          <Text style={styles.hint}>使う表紙を選ぶと、この端末へ画像を取り込みます。</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.candidateRow}
          >
            {visibleCandidates.map((candidate) => {
              const selected = candidate.url === currentUrl;
              const saving = candidate.url === savingUrl;
              return (
                <TouchableOpacity
                  key={candidate.url}
                  style={[styles.candidate, selected && styles.candidateSelected]}
                  onPress={() => void select(candidate)}
                  disabled={Boolean(savingUrl)}
                  accessibilityRole="button"
                  accessibilityLabel={`${candidate.title ?? title ?? '本'}の表紙候補、${sourceLabel(candidate.source)}`}
                  accessibilityState={{ selected, disabled: Boolean(savingUrl) }}
                >
                  <Image
                    source={{ uri: candidate.url }}
                    style={styles.candidateImage}
                    resizeMode="contain"
                    onError={() => setFailedUrls((urls) => [...urls, candidate.url])}
                    accessibilityIgnoresInvertColors
                  />
                  <Text style={styles.candidateSource} numberOfLines={2}>
                    {candidate.exactIsbn ? 'ISBN一致 · ' : ''}{sourceLabel(candidate.source)}
                  </Text>
                  {saving && <ActivityIndicator size="small" color={COLORS.accent} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  searchButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  searchButtonText: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  error: { color: COLORS.danger, fontSize: 12, lineHeight: 18 },
  results: { gap: 8 },
  candidateRow: { gap: 10, paddingRight: 4 },
  candidate: {
    width: 104,
    minHeight: 158,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    padding: 8,
    gap: 6,
    alignItems: 'center',
  },
  candidateSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  candidateImage: {
    width: 78,
    height: 104,
    borderRadius: 6,
    backgroundColor: COLORS.cardElevated,
  },
  candidateSource: { color: COLORS.mutedLight, fontSize: 10.5, lineHeight: 14, textAlign: 'center' },
});
