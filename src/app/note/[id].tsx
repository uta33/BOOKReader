import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { COLORS } from '../../constants/colors';
import { TITLE_TEXT, QUOTE_TEXT } from '../../constants/typography';
import { BOOKS_PER_VOLUME } from '../../constants/readingNote';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PurposeChips } from '../../components/common/PurposeChips';
import { StarRating } from '../../components/common/StarRating';
import { NoteSection } from '../../components/note/NoteSection';
import { DogEarRow } from '../../components/note/DogEarRow';
import { LinkRow } from '../../components/note/LinkRow';
import { AddLinkModal } from '../../components/note/AddLinkModal';
import { finishedSeq, notePosition } from '../../services/readingProgress';
import { generateSummary, isSummaryApiConfigured } from '../../services/summaryApi';
import { buildObsidianExport, buildObsidianOpenUri } from '../../services/obsidianExport';
import {
  exportBookToObsidianDirectory,
  isDirectoryPickerCancellation,
  pickObsidianVaultDirectory,
} from '../../services/obsidianDirectory';
import { useLibraryStore } from '../../store/libraryStore';
import { useSettingsStore } from '../../store/settingsStore';

export default function NoteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const books = useLibraryStore((s) => s.books);
  const updateBook = useLibraryStore((s) => s.updateBook);
  const removeDogEar = useLibraryStore((s) => s.removeDogEar);
  const addLink = useLibraryStore((s) => s.addLink);
  const removeLink = useLibraryStore((s) => s.removeLink);
  const togglePurpose = useLibraryStore((s) => s.togglePurpose);
  const setFinished = useLibraryStore((s) => s.setFinished);

  const book = books.find((b) => b.id === id);

  // 入力中はローカルに持ち、保存時に一度だけ書く（saveLibrary は全書籍を
  // 再シリアライズするので、onChangeText からストアを触ってはいけない）。
  const [summary, setSummary] = useState(book?.summary ?? '');
  const [recap, setRecap] = useState(book?.recap ?? '');
  const [linkModal, setLinkModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [obsidianError, setObsidianError] = useState<string | null>(null);

  const apiBaseUrl = useSettingsStore((s) => s.apiBaseUrl);
  const obsidianVault = useSettingsStore((s) => s.obsidianVault);
  const obsidianDirectoryUri = useSettingsStore((s) => s.obsidianDirectoryUri);
  const obsidianDirectoryName = useSettingsStore((s) => s.obsidianDirectoryName);
  const setObsidianDirectory = useSettingsStore((s) => s.setObsidianDirectory);
  // 設定が変わったら判定し直す（apiBaseUrl を依存に置くため useMemo）。
  const aiAvailable = useMemo(() => isSummaryApiConfigured(), [apiBaseUrl]);

  const spread = useMemo(() => {
    if (!book) return null;
    const seq = finishedSeq(books, book.id);
    // 未読了の本は、次に埋まる見開きを仮に示す。
    const n = seq ?? books.filter((b) => b.finishedAt != null).length;
    return { ...notePosition(n), provisional: seq === null };
  }, [books, book]);

  if (!book) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader onBack={() => router.back()} />
        <Text style={styles.missing}>本が見つかりません</Text>
      </SafeAreaView>
    );
  }

  const commitSummary = () => {
    if (summary !== (book.summary ?? '')) updateBook(book.id, { summary: summary || undefined });
  };
  const commitRecap = () => {
    if (recap !== (book.recap ?? '')) {
      updateBook(book.id, {
        recap: recap || undefined,
        recapCreatedAt: recap ? Date.now() : undefined,
      });
    }
  };

  const generateWithAi = async () => {
    setGenerating(true);
    try {
      const { body } = await generateSummary(book.title, book.author);
      setSummary(body);
      updateBook(book.id, { summary: body });
    } catch (e: unknown) {
      Alert.alert('生成できませんでした', e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const confirmDeleteDogEar = (dogEarId: string) =>
    Alert.alert('この抜き書きを削除', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeDogEar(book.id, dogEarId) },
    ]);

  const confirmDeleteLink = (linkId: string) =>
    Alert.alert('このリンクを削除', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeLink(book.id, linkId) },
    ]);

  const exportToObsidian = async () => {
    setObsidianError(null);
    const currentSummary = summary.trim() || undefined;
    const currentRecap = recap.trim() || undefined;
    const snapshot = {
      ...book,
      summary: currentSummary,
      recap: currentRecap,
    };

    if (currentSummary !== book.summary || currentRecap !== book.recap) {
      updateBook(book.id, {
        summary: currentSummary,
        recap: currentRecap,
        recapCreatedAt: currentRecap ? (book.recapCreatedAt ?? Date.now()) : undefined,
      });
    }

    try {
      let directoryUri = obsidianDirectoryUri;
      let directoryName = obsidianDirectoryName;
      const hasImages = snapshot.dogEars.some((dogEar) => Boolean(dogEar.photoUri));

      if (hasImages && Platform.OS === 'android' && !directoryUri) {
        const selection = await pickObsidianVaultDirectory();
        directoryUri = selection.uri;
        directoryName = selection.name;
        setObsidianDirectory(selection.uri, selection.name);
      }

      if (Platform.OS === 'android' && directoryUri) {
        const result = await exportBookToObsidianDirectory(snapshot, directoryUri);
        try {
          await Linking.openURL(
            buildObsidianOpenUri(result.noteName, obsidianVault.trim() || directoryName),
          );
        } catch {
          Alert.alert(
            '書き出しは完了しました',
            `Markdownと画像${result.imageCount}件をVaultへ保存しましたが、Obsidianを開けませんでした。`,
          );
        }
        return;
      }

      if (hasImages) {
        throw new Error('画像付き書き出しには、設定でVaultフォルダを選択してください。');
      }
      const result = buildObsidianExport(snapshot, obsidianVault, { overwrite: true });
      if (result.viaClipboard) await Clipboard.setStringAsync(result.content);
      await Linking.openURL(result.uri);
    } catch (error) {
      if (isDirectoryPickerCancellation(error)) return;
      setObsidianError(error instanceof Error
        ? error.message
        : 'Obsidianへ送れませんでした。端末にObsidianがあることと、Vault名を確認してください。');
    }
  };

  const confirmObsidianExport = () => {
    const hasImages = book.dogEars.some((dogEar) => Boolean(dogEar.photoUri));
    const directoryMessage = hasImages
      ? obsidianDirectoryUri
        ? `画像は「READING NOTE/_attachments」へコピーします（${obsidianDirectoryName || '選択済みVault'}）。`
        : '画像を含めるため、次にObsidian Vaultのルートフォルダを選びます。初回だけ必要です。'
      : '';
    Alert.alert(
      'Obsidianへ書き出す',
      `Vaultの「READING NOTE」フォルダへ保存します。${directoryMessage}\n\n同名ノートがある場合は内容を置き換えます。Obsidian側で追記した内容も置き換わるため確認してください。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '書き出す',
          style: 'destructive',
          onPress: () => void exportToObsidian(),
        },
      ],
    );
  };

  const finished = book.finishedAt != null;
  const subtitle = [book.author, book.publisher, book.totalPages ? `${book.totalPages}ページ` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader onBack={() => router.back()} flush />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* 柱 — 縦持ちで見開きは組めないので、1冊＝1画面の不変条件だけを残す */}
          <View style={styles.hashira}>
            <View style={styles.hashiraRun}>
              <Text style={styles.runText}>READING NOTE</Text>
              <Text style={styles.runText}>
                {spread
                  ? `${spread.volume}冊目 · ${spread.page} / ${BOOKS_PER_VOLUME}${spread.provisional ? '（予定）' : ''}`
                  : ''}
              </Text>
            </View>
            <Text style={styles.hashiraTitle}>{book.title}</Text>
            {subtitle.length > 0 && <Text style={styles.hashiraBy}>{subtitle}</Text>}
            <View style={styles.hashiraFoot}>
              <StarRating
                value={book.rating}
                onAccent
                onChange={(v) => updateBook(book.id, { rating: v || undefined })}
              />
              {finished && (
                <View style={styles.finishedBadge}>
                  <Text style={styles.finishedBadgeText}>✓ 読了</Text>
                </View>
              )}
            </View>
          </View>

          <NoteSection title="読む目的">
            <PurposeChips
              selected={book.purposes}
              onToggle={(p) => togglePurpose(book.id, p)}
            />
          </NoteSection>

          <NoteSection
            title="ドッグイヤー"
            actionLabel="＋ 抜き書きを追加"
            onAction={() =>
              router.push({ pathname: '/dogear/[bookId]', params: { bookId: book.id } })
            }
          >
            {book.dogEars.length === 0 ? (
              <Text style={styles.empty}>
                折ったページを開いて、線を引いた箇所を書き写しましょう。
                写している間に頭に入ります。
              </Text>
            ) : (
              book.dogEars.map((d) => (
                <DogEarRow
                  key={d.id}
                  dogEar={d}
                  onPress={() =>
                    router.push({
                      pathname: '/dogear/[bookId]',
                      params: { bookId: book.id, dogEarId: d.id },
                    })
                  }
                  onLongPress={() => confirmDeleteDogEar(d.id)}
                />
              ))
            )}
          </NoteSection>

          <NoteSection
            title="まとめ"
            actionLabel={aiAvailable ? (generating ? '生成中…' : '✨ AIに書かせる') : undefined}
            onAction={aiAvailable && !generating ? generateWithAi : undefined}
          >
            <TextInput
              style={[styles.input, styles.inputProse]}
              value={summary}
              onChangeText={setSummary}
              onBlur={commitSummary}
              placeholder="この本は何の本だったか"
              placeholderTextColor={COLORS.muted}
              multiline
              textAlignVertical="top"
              editable={!generating}
            />
            {generating && (
              <View style={styles.busyRow}>
                <ActivityIndicator size="small" color={COLORS.accent} />
                <Text style={styles.empty}>AIが要約を作成しています…（30秒ほど）</Text>
              </View>
            )}
            {!aiAvailable && (
              <Text style={styles.empty}>
                AI要約を使うには、設定でサーバーURLを指定してください。
              </Text>
            )}
          </NoteSection>

          <NoteSection title="ふりかえり（自分の言葉）">
            <TextInput
              style={[styles.input, styles.inputProse]}
              value={recap}
              onChangeText={setRecap}
              onBlur={commitRecap}
              placeholder="何を学び、どう使うか"
              placeholderTextColor={COLORS.muted}
              multiline
              textAlignVertical="top"
            />
          </NoteSection>

          <NoteSection title="デジタルリンク" actionLabel="＋ 追加" onAction={() => setLinkModal(true)}>
            {book.links.length === 0 ? (
              <Text style={styles.empty}>
                この本についての AI 対話やドキュメントの URL を紐づけられます。
              </Text>
            ) : (
              book.links.map((l) => (
                <LinkRow key={l.id} link={l} onLongPress={() => confirmDeleteLink(l.id)} />
              ))
            )}
          </NoteSection>

          <View style={styles.obsidianWrap}>
            <TouchableOpacity
              style={styles.obsidianBtn}
              onPress={confirmObsidianExport}
              accessibilityRole="button"
              accessibilityLabel="この読書ノートをObsidianへ書き出す"
            >
              <Text style={styles.obsidianText}>Obsidianへ書き出す</Text>
            </TouchableOpacity>
            <Text style={styles.obsidianHint}>
              書誌・目的・ドッグイヤー・画像・まとめ・ふりかえり・リンクをMarkdownで保存します。
            </Text>
            {obsidianError && (
              <Text style={styles.obsidianError} accessibilityLiveRegion="polite">
                {obsidianError}
              </Text>
            )}
          </View>

          {book.kind === 'content' && book.sentences.length > 0 && (
            <TouchableOpacity
              style={styles.listenBtn}
              onPress={() => router.push(`/reader/${book.id}`)}
            >
              <Text style={styles.listenText}>▶ 聴く</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.finishBtn, finished && styles.finishBtnOn]}
            onPress={() => setFinished(book.id, !finished)}
          >
            <Text style={[styles.finishText, finished && styles.finishTextOn]}>
              {finished ? '読了を取り消す' : '✓ 読了にする'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AddLinkModal
        visible={linkModal}
        onClose={() => setLinkModal(false)}
        onAdd={(link) => addLink(book.id, link)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  missing: { color: COLORS.text, padding: 20 },
  body: { paddingBottom: 32, gap: 22 },

  hashira: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 6,
  },
  hashiraRun: { flexDirection: 'row', justifyContent: 'space-between' },
  runText: {
    color: COLORS.onAccent,
    fontSize: 10.5,
    letterSpacing: 1.6,
    opacity: 0.82,
  },
  hashiraTitle: { ...TITLE_TEXT, color: COLORS.onAccent, fontWeight: '600' },
  hashiraBy: { color: COLORS.onAccent, fontSize: 12, opacity: 0.82 },
  hashiraFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  finishedBadge: {
    backgroundColor: 'rgba(246,247,243,0.95)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  finishedBadgeText: { color: COLORS.accent, fontSize: 11, fontWeight: '700' },

  empty: { color: COLORS.muted, fontSize: 12.5, lineHeight: 20 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.text,
  },
  inputProse: { ...QUOTE_TEXT, minHeight: 92 },

  listenBtn: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
  },
  listenText: { color: COLORS.accent, fontSize: 15, fontWeight: '700', textAlign: 'center' },

  obsidianWrap: { marginHorizontal: 20, gap: 8 },
  obsidianBtn: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  obsidianText: { color: COLORS.accent, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  obsidianHint: { color: COLORS.muted, fontSize: 11.5, lineHeight: 18 },
  obsidianError: { color: '#b54b4b', fontSize: 12, lineHeight: 18 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  finishBtn: {
    borderWidth: 1,
    borderColor: COLORS.done,
    borderRadius: 12,
    paddingVertical: 14,
  },
  finishBtnOn: { backgroundColor: COLORS.doneDim },
  finishText: { color: COLORS.done, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  finishTextOn: { color: COLORS.muted },
});
