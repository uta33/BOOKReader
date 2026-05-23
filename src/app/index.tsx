import React, { useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';
import { BookCard } from '../components/library/BookCard';
import { EmptyLibrary } from '../components/library/EmptyLibrary';
import { useLibraryStore } from '../store/libraryStore';
import { useReaderStore } from '../store/readerStore';
import { usePdfExtraction } from '../hooks/usePdfExtraction';
import { deleteCacheForBook } from '../services/googleTTS';

export default function HomeScreen() {
  const router = useRouter();
  const { books, removeBook } = useLibraryStore();
  const { currentBookId } = useReaderStore();
  const { pickAndImport, loading } = usePdfExtraction();

  const openBook = (id: string) => {
    router.push(`/reader/${id}`);
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
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>BOOKReader</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {books.length === 0 ? (
        <EmptyLibrary onImport={pickAndImport} />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BookCard
              book={item}
              isLastOpened={item.id === currentBookId}
              onPress={() => openBook(item.id)}
              onLongPress={() => confirmDelete(item.id, item.title)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={pickAndImport}
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
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  settingsIcon: { fontSize: 22 },
  list: { padding: 16 },
  fab: {
    position: 'absolute',
    bottom: 32,
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
  fabText: { color: COLORS.white, fontSize: 32, fontWeight: '300', lineHeight: 36 },
});
