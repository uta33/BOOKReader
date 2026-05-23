import React, { useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { TextDisplay } from '../../components/reader/TextDisplay';
import { PageIndicator } from '../../components/reader/PageIndicator';
import { LoadingOverlay } from '../../components/reader/LoadingOverlay';
import { PlayerBar } from '../../components/player/PlayerBar';
import { useLibraryStore } from '../../store/libraryStore';
import { useReaderStore } from '../../store/readerStore';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useTTSCache } from '../../hooks/useTTSCache';

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { books, updateBook } = useLibraryStore();
  const book = books.find((b) => b.id === id);
  const {
    currentSentenceIdx,
    isPlaying,
    isGenerating,
    generationProgress,
    generationTotal,
    setCurrentBook,
    setCurrentSentenceIdx,
    setGenerating,
    reset,
  } = useReaderStore();

  const sentences = book?.sentences ?? [];
  const { getOrGenerate, generateAll } = useTTSCache(id ?? '');
  const { play, pause, skipForward, skipBack } = useAudioPlayer(id ?? '', sentences);

  useEffect(() => {
    if (!book) return;
    setCurrentBook(id ?? '');
    setCurrentSentenceIdx(book.lastSentenceIdx ?? 0);
  }, [id]);

  const startGeneration = useCallback(async () => {
    if (!book) return;
    setGenerating(true, 0, sentences.length);
    try {
      await generateAll(sentences, (done, total) => {
        setGenerating(true, done, total);
        updateBook(book.id, {
          cachedSentenceIds: sentences.slice(0, done).map((s) => s.id),
        });
      });
    } catch (e: any) {
      Alert.alert('エラー', e.message);
    } finally {
      setGenerating(false);
    }
  }, [book, sentences, generateAll, setGenerating, updateBook]);

  const handleSentencePress = useCallback(
    async (idx: number) => {
      setCurrentSentenceIdx(idx);
      if (isPlaying) {
        await pause();
        setCurrentSentenceIdx(idx);
        await play();
      }
    },
    [isPlaying, pause, play, setCurrentSentenceIdx]
  );

  const goBack = useCallback(() => {
    updateBook(id ?? '', { lastSentenceIdx: currentSentenceIdx });
    router.back();
  }, [id, currentSentenceIdx, router, updateBook]);

  if (!book) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: COLORS.white, padding: 20 }}>本が見つかりません</Text>
      </SafeAreaView>
    );
  }

  const currentPage = sentences[currentSentenceIdx]?.pageNumber ?? 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{book.title}</Text>
        <TouchableOpacity onPress={startGeneration} disabled={isGenerating}>
          <Text style={styles.genBtn}>
            {isGenerating ? '...' : '音声生成'}
          </Text>
        </TouchableOpacity>
      </View>

      <PageIndicator
        currentIdx={currentSentenceIdx}
        total={sentences.length}
        currentPage={currentPage}
        totalPages={book.totalPages}
      />

      <TextDisplay
        sentences={sentences}
        currentIdx={currentSentenceIdx}
        onSentencePress={handleSentencePress}
      />

      <PlayerBar
        onPlay={play}
        onPause={pause}
        onSkipForward={skipForward}
        onSkipBack={skipBack}
      />

      {isGenerating && (
        <LoadingOverlay
          progress={generationProgress}
          total={generationTotal}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { color: COLORS.accent, fontSize: 28, lineHeight: 32 },
  title: {
    flex: 1,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  genBtn: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
});
