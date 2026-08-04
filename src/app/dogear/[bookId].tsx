import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../constants/colors';
import { QUOTE_TEXT } from '../../constants/typography';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import {
  persistDogEarImage,
  removeManagedDogEarImage,
  type PendingDogEarImage,
} from '../../services/dogEarImage';
import { useLibraryStore } from '../../store/libraryStore';
import { deleteAttachment } from '../../services/attachmentClient';
import { useSpeechInput, type SpeechInputTarget } from '../../hooks/useSpeechInput';

function selectedImage(result: ImagePicker.ImagePickerResult): PendingDogEarImage | null {
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType };
}

export default function DogEarScreen() {
  const router = useRouter();
  const { bookId, dogEarId } = useLocalSearchParams<{ bookId: string; dogEarId?: string }>();
  const books = useLibraryStore((s) => s.books);
  const addDogEar = useLibraryStore((s) => s.addDogEar);
  const updateDogEar = useLibraryStore((s) => s.updateDogEar);
  const removeDogEar = useLibraryStore((s) => s.removeDogEar);

  const book = books.find((b) => b.id === bookId);
  const existing = dogEarId ? book?.dogEars.find((d) => d.id === dogEarId) : undefined;
  const draftId = useRef(
    existing?.id ?? `de_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  );

  // すべてローカル state。保存を押したときだけストアに書く。
  const [page, setPage] = useState(existing?.page ? String(existing.page) : '');
  const [line, setLine] = useState(existing?.line != null ? String(existing.line) : '');
  const [quote, setQuote] = useState(existing?.quote ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [photo, setPhoto] = useState<PendingDogEarImage | null>(
    existing?.photoUri ? { uri: existing.photoUri } : null,
  );
  const [saving, setSaving] = useState(false);
  const speechInput = useSpeechInput({
    quote,
    comment,
    setQuote,
    setComment,
    contextualStrings: [book?.title ?? '', book?.author ?? ''],
  });

  const speechStatus = (target: SpeechInputTarget) => {
    if (!speechInput.isActive(target)) return null;
    if (speechInput.phase === 'preparing') return 'マイクを準備しています…';
    if (speechInput.phase === 'stopping') return '文字に変換しています…';
    return '聞き取り中です。読み上げると文字になります。';
  };

  const speechButtonLabel = (target: SpeechInputTarget) => {
    if (!speechInput.isActive(target)) return '音声入力';
    if (speechInput.phase === 'preparing') return '準備中';
    if (speechInput.phase === 'stopping') return '変換中';
    return '停止';
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void ImagePicker.getPendingResultAsync().then((pending) => {
      if (pending && 'canceled' in pending) {
        const image = selectedImage(pending);
        if (image) setPhoto(image);
      }
    }).catch(() => undefined);
  }, []);

  if (!book) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader onBack={() => router.back()} />
        <Text style={styles.missing}>本が見つかりません</Text>
      </SafeAreaView>
    );
  }

  const canSave = quote.trim().length > 0;

  const onSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const parsedPage = Number.parseInt(page, 10);
    const parsedLine = Number.parseInt(line, 10);
    let savedPhotoUri = photo?.uri;
    let createdPhotoUri: string | undefined;

    try {
      if (photo && photo.uri !== existing?.photoUri) {
        createdPhotoUri = await persistDogEarImage(photo, draftId.current);
        savedPhotoUri = createdPhotoUri;
      }

      const fields = {
        page: Number.isFinite(parsedPage) ? Math.max(0, parsedPage) : 0,
        line: Number.isFinite(parsedLine) ? Math.max(1, parsedLine) : undefined,
        quote: quote.trim(),
        comment: comment.trim() || undefined,
        photoUri: savedPhotoUri,
        photoAttachmentId:
          savedPhotoUri === existing?.photoUri ? existing?.photoAttachmentId : undefined,
        photoAttachmentSyncedAt:
          savedPhotoUri === existing?.photoUri ? existing?.photoAttachmentSyncedAt : undefined,
      };

      if (existing) {
        updateDogEar(book.id, existing.id, fields);
      } else {
        addDogEar(book.id, {
          id: draftId.current,
          createdAt: Date.now(),
          ...fields,
        });
      }

      if (existing?.photoUri && existing.photoUri !== savedPhotoUri) {
        removeManagedDogEarImage(existing.photoUri);
      }
      if (existing?.photoAttachmentId && existing.photoUri !== savedPhotoUri) {
        void deleteAttachment(existing.photoAttachmentId).catch(() => undefined);
      }
      router.back();
    } catch (error) {
      if (createdPhotoUri) removeManagedDogEarImage(createdPhotoUri);
      Alert.alert('画像を保存できませんでした', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('カメラを使えません', '設定でカメラを許可してから、もう一度お試しください。');
        return;
      }
      const image = selectedImage(
        await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 1,
          cameraType: ImagePicker.CameraType.back,
        }),
      );
      if (image) setPhoto(image);
    } catch (error) {
      Alert.alert('撮影できませんでした', error instanceof Error ? error.message : String(error));
    }
  };

  const choosePhoto = async () => {
    try {
      const image = selectedImage(
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 1,
        }),
      );
      if (image) setPhoto(image);
    } catch (error) {
      Alert.alert('画像を選べませんでした', error instanceof Error ? error.message : String(error));
    }
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('この抜き書きを削除', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          removeDogEar(book.id, existing.id);
          removeManagedDogEarImage(existing.photoUri);
          void deleteAttachment(existing.photoAttachmentId).catch(() => undefined);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="抜き書き"
        onBack={() => router.back()}
        right={
          existing ? (
            <TouchableOpacity onPress={onDelete} hitSlop={10}>
              <Text style={styles.delete}>削除</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.bookLine} numberOfLines={1}>
            {book.title}
            {book.author ? ` · ${book.author}` : ''}
          </Text>

          <View style={styles.plRow}>
            <View style={styles.flex}>
              <Text style={styles.label}>P — ページ</Text>
              <TextInput
                style={[styles.input, styles.number]}
                value={page}
                onChangeText={(t) => setPage(t.replace(/[^0-9]/g, ''))}
                placeholder="—"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>L — 行（任意）</Text>
              <TextInput
                style={[styles.input, styles.number]}
                value={line}
                onChangeText={(t) => setLine(t.replace(/[^0-9]/g, ''))}
                placeholder="—"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View>
            <View style={styles.fieldHeader}>
              <Text style={[styles.label, styles.fieldHeaderLabel]}>
                抜き書き<Text style={styles.required}> ✳︎</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.speechButton,
                  speechInput.isActive('quote') && styles.speechButtonActive,
                  speechInput.isUnavailableWhileActive('quote') && styles.speechButtonDisabled,
                ]}
                onPress={() => void speechInput.toggle('quote')}
                disabled={
                  speechInput.isUnavailableWhileActive('quote') ||
                  (speechInput.isActive('quote') && speechInput.phase !== 'listening')
                }
                accessibilityRole="button"
                accessibilityLabel={
                  speechInput.isActive('quote') ? '抜き書きの音声入力を停止' : '抜き書きを音声入力'
                }
                accessibilityHint="読み上げた内容を入力欄へ文字で追加します"
                accessibilityState={{
                  disabled:
                    speechInput.isUnavailableWhileActive('quote') ||
                    (speechInput.isActive('quote') && speechInput.phase !== 'listening'),
                  busy:
                    speechInput.isActive('quote') &&
                    (speechInput.phase === 'preparing' || speechInput.phase === 'stopping'),
                }}
              >
                {(speechInput.phase === 'preparing' || speechInput.phase === 'stopping') &&
                speechInput.isActive('quote') ? (
                  <ActivityIndicator size="small" color={COLORS.onAccent} />
                ) : null}
                <Text
                  style={[
                    styles.speechButtonText,
                    speechInput.isActive('quote') && styles.speechButtonTextActive,
                  ]}
                >
                  {speechButtonLabel('quote')}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.genko]}
              value={quote}
              onChangeText={(text) => {
                setQuote(text);
                speechInput.clearError('quote');
              }}
              placeholder="線を引いた箇所を書き写す"
              placeholderTextColor={COLORS.muted}
              multiline
              textAlignVertical="top"
              autoFocus={!existing}
            />
            {speechStatus('quote') ? (
              <View style={styles.speechStatus} accessibilityLiveRegion="polite">
                {speechInput.phase === 'listening' ? (
                  <View style={styles.listeningDot} />
                ) : (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                )}
                <Text style={styles.speechStatusText}>{speechStatus('quote')}</Text>
              </View>
            ) : null}
            {speechInput.error?.target === 'quote' ? (
              <Text style={styles.speechError} accessibilityRole="alert">
                {speechInput.error.message}
              </Text>
            ) : null}
          </View>

          <View>
            <View style={styles.fieldHeader}>
              <Text style={[styles.label, styles.fieldHeaderLabel]}>コメント（なぜ折ったか）</Text>
              <TouchableOpacity
                style={[
                  styles.speechButton,
                  speechInput.isActive('comment') && styles.speechButtonActive,
                  speechInput.isUnavailableWhileActive('comment') && styles.speechButtonDisabled,
                ]}
                onPress={() => void speechInput.toggle('comment')}
                disabled={
                  speechInput.isUnavailableWhileActive('comment') ||
                  (speechInput.isActive('comment') && speechInput.phase !== 'listening')
                }
                accessibilityRole="button"
                accessibilityLabel={
                  speechInput.isActive('comment') ? 'コメントの音声入力を停止' : 'コメントを音声入力'
                }
                accessibilityHint="読み上げた内容を入力欄へ文字で追加します"
                accessibilityState={{
                  disabled:
                    speechInput.isUnavailableWhileActive('comment') ||
                    (speechInput.isActive('comment') && speechInput.phase !== 'listening'),
                  busy:
                    speechInput.isActive('comment') &&
                    (speechInput.phase === 'preparing' || speechInput.phase === 'stopping'),
                }}
              >
                {(speechInput.phase === 'preparing' || speechInput.phase === 'stopping') &&
                speechInput.isActive('comment') ? (
                  <ActivityIndicator size="small" color={COLORS.onAccent} />
                ) : null}
                <Text
                  style={[
                    styles.speechButtonText,
                    speechInput.isActive('comment') && styles.speechButtonTextActive,
                  ]}
                >
                  {speechButtonLabel('comment')}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.commentInput]}
              value={comment}
              onChangeText={(text) => {
                setComment(text);
                speechInput.clearError('comment');
              }}
              placeholder="思ったこと"
              placeholderTextColor={COLORS.muted}
              multiline
              textAlignVertical="top"
            />
            {speechStatus('comment') ? (
              <View style={styles.speechStatus} accessibilityLiveRegion="polite">
                {speechInput.phase === 'listening' ? (
                  <View style={styles.listeningDot} />
                ) : (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                )}
                <Text style={styles.speechStatusText}>{speechStatus('comment')}</Text>
              </View>
            ) : null}
            {speechInput.error?.target === 'comment' ? (
              <Text style={styles.speechError} accessibilityRole="alert">
                {speechInput.error.message}
              </Text>
            ) : null}
          </View>

          <View>
            <Text style={styles.label}>図・グラフ・写真（任意）</Text>
            {photo ? (
              <View style={styles.photoCard}>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.photo}
                  resizeMode="contain"
                  accessible
                  accessibilityLabel="抜き書きに添付した画像"
                />
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={styles.photoAction}
                    onPress={() => void choosePhoto()}
                    accessibilityRole="button"
                  >
                    <Text style={styles.photoActionText}>選び直す</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.photoAction, styles.photoRemove]}
                    onPress={() => setPhoto(null)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.photoRemoveText}>画像を外す</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.photoAction}
                  onPress={() => void takePhoto()}
                  accessibilityRole="button"
                  accessibilityLabel="カメラで図やグラフを撮影"
                >
                  <Text style={styles.photoActionText}>カメラで撮る</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoAction}
                  onPress={() => void choosePhoto()}
                  accessibilityRole="button"
                  accessibilityLabel="端末から図やグラフの画像を選ぶ"
                >
                  <Text style={styles.photoActionText}>端末から選ぶ</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.photoHint}>
              文字のある図を読めるよう、切り抜きや圧縮をせず元の比率で保存します。
            </Text>
          </View>

          <Text style={styles.helper}>
            音声入力は既存の文章を消さず、次の行へ追加します。
            <Text style={styles.helperStrong}>認識された文字を確認してから保存</Text>
            してください。手入力も引き続き使えます。
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.disabled]}
            onPress={() => void onSave()}
            disabled={!canSave || saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.onAccent} />
            ) : (
              <Text style={styles.saveText}>保存する</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  missing: { color: COLORS.text, padding: 20 },
  delete: { color: COLORS.shu, fontSize: 13.5, fontWeight: '700' },

  body: { padding: 20, gap: 18, paddingBottom: 32 },
  bookLine: { color: COLORS.muted, fontSize: 12 },

  plRow: { flexDirection: 'row', gap: 12 },
  label: { color: COLORS.muted, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  required: { color: COLORS.shu },

  fieldHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  fieldHeaderLabel: { flex: 1, marginBottom: 0 },
  speechButton: {
    minHeight: 44,
    minWidth: 92,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  speechButtonActive: { backgroundColor: COLORS.accent },
  speechButtonDisabled: { opacity: 0.4 },
  speechButtonText: { color: COLORS.accent, fontSize: 12.5, fontWeight: '700' },
  speechButtonTextActive: { color: COLORS.onAccent },
  speechStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  speechStatusText: { flex: 1, color: COLORS.accent, fontSize: 12, lineHeight: 18 },
  listeningDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.shu },
  speechError: { color: COLORS.danger, fontSize: 12, lineHeight: 18, marginTop: 8 },

  input: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.text,
    fontSize: 15,
  },
  number: {
    ...QUOTE_TEXT,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  genko: { ...QUOTE_TEXT, color: COLORS.text, minHeight: 150 },
  commentInput: { minHeight: 70, fontSize: 14 },

  photoCard: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  photo: { width: '100%', height: 240, borderRadius: 8, backgroundColor: COLORS.bg },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoAction: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  photoActionText: { color: COLORS.accent, fontSize: 13, fontWeight: '700' },
  photoRemove: { borderColor: '#b54b4b' },
  photoRemoveText: { color: '#b54b4b', fontSize: 13, fontWeight: '700' },
  photoHint: { color: COLORS.muted, fontSize: 11.5, lineHeight: 18, marginTop: 7 },

  helper: { color: COLORS.muted, fontSize: 11.5, lineHeight: 19 },
  helperStrong: { color: COLORS.shu, fontWeight: '700' },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveBtn: { backgroundColor: COLORS.shu, borderRadius: 12, paddingVertical: 14 },
  saveText: { color: COLORS.onAccent, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.4 },
});
