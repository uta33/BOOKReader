import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { isPurposeId, purposeLabel } from '../../constants/purposes';
import { BookCard } from '../../components/library/BookCard';
import { EmptyLibrary } from '../../components/library/EmptyLibrary';
import { useLibraryStore } from '../../store/libraryStore';
import { useReaderStore } from '../../store/readerStore';
import { usePdfExtraction } from '../../hooks/usePdfExtraction';
import { deleteCacheForBook } from '../../services/googleTTS';

type KindFilter = 'all' | 'paper' | 'content';

const FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'paper', label: '紙の本' },
  { id: 'content', label: 'コンテンツ' },
];

export default function ShelfScreen() {
  const router = useRouter();
  const { books, removeBook, updateBook } = useLibraryStore();
  const { currentBookId } = useReaderStore();
  const { pickAndImport, loading, error } = usePdfExtraction();
  // 進捗画面の「10の目的」から絞り込んで飛んでくる。
  const { purpose } = useLocalSearchParams<{ purpose?: string }>();
  const [kind, setKind] = useState<KindFilter>('all');

  const activePurpose = isPurposeId(purpose) ? purpose : undefined;

  const visible = useMemo(
    () =>
      books
        .filter((b) => (kind === 'all' ? true : b.kind === kind))
        .filter((b) => (activePurpose ? b.purposes.includes(activePurpose) : true)),
    [books, kind, activePurpose],
  );

  useEffect(() => {
    if (error) {
      Alert.alert('読み込みエラー', error, [{ text: 'OK' }]);
    }
  }, [error]);

  const openBook = (id: string) => {
    const book = books.find((b) => b.id === id);
    // 紙の本には読み上げるものが無いので、マガジンノートを開く。
    if (book?.kind === 'paper') {
      router.push({ pathname: '/note/[id]', params: { id } });
      return;
    }
    router.push(`/reader/${id}`);
  };

  const addBook = () => {
    Alert.alert('本を追加', undefined, [
      { text: '📖 紙の本を登録（JANコード）', onPress: () => router.push('/book/scan') },
      { text: '📄 ファイルを取り込む', onPress: pickAndImport },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(`「${title}」を削除`, '音声キャッシュも全て削除されます。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await deleteCacheForBook(id);
          removeBook(id);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>本棚</Text>
        <Text style={styles.count}>{visible.length}冊</Text>
      </View>

      {books.length === 0 ? (
        <EmptyLibrary onScan={() => router.push('/book/scan')} onImport={pickAndImport} />
      ) : (
        <>
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterBtn, kind === f.id && styles.filterBtnOn]}
                onPress={() => setKind(f.id)}
              >
                <Text style={[styles.filterText, kind === f.id && styles.filterTextOn]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activePurpose && (
            <TouchableOpacity
              style={styles.purposeFilter}
              onPress={() => router.replace('/shelf')}
              accessibilityRole="button"
              accessibilityLabel={`目的「${purposeLabel(activePurpose)}」の絞り込みを解除`}
            >
              <Text style={styles.purposeFilterText}>
                目的「{purposeLabel(activePurpose)}」で絞り込み中　解除
              </Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={visible}
            keyExtractor={(b) => b.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.noMatch}>この条件に合う本がありません。</Text>
            }
            renderItem={({ item }) => (
              <BookCard
                book={item}
                isLastOpened={item.id === currentBookId}
                onPress={() => openBook(item.id)}
                onLongPress={() => confirmDelete(item.id, item.title)}
                onCoverResolved={(coverUrl) => {
                  if (item.coverUrl !== coverUrl) updateBook(item.id, { coverUrl });
                }}
              />
            )}
          />
        </>
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={addBook}
        style={styles.fab}
        disabled={loading}
      >
        <Text style={styles.fabText}>{loading ? '...' : '+'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logo: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  count: { color: COLORS.muted, fontSize: 13 },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: COLORS.cardElevated,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 3,
    borderRadius: 10,
  },
  filterBtn: { flex: 1, paddingVertical: 6, borderRadius: 8 },
  filterBtnOn: { backgroundColor: COLORS.card },
  filterText: { color: COLORS.muted, fontSize: 12.5, textAlign: 'center' },
  filterTextOn: { color: COLORS.text, fontWeight: '700' },
  purposeFilter: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: COLORS.accentDim,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  purposeFilterText: { color: COLORS.accentBright, fontSize: 12, fontWeight: '600' },
  noMatch: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
  list: { padding: 16 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { color: COLORS.onAccent, fontSize: 32, fontWeight: '300', lineHeight: 36 },
});
