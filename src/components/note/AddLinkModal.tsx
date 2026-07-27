import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import type { DigitalLink, LinkKind } from '../../types/book';

/**
 * Alert.prompt は iOS 専用で Android では黙って何も起きないため、
 * リンク入力は Modal で作る。
 */

const KINDS: { id: LinkKind; label: string }[] = [
  { id: 'notebooklm', label: 'NotebookLM' },
  { id: 'claude', label: 'Claude' },
  { id: 'gdocs', label: 'ドキュメント' },
  { id: 'other', label: 'その他' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (link: DigitalLink) => void;
}

export function AddLinkModal({ visible, onClose, onAdd }: Props) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<LinkKind>('notebooklm');

  const reset = () => {
    setLabel('');
    setUrl('');
    setKind('notebooklm');
  };

  const close = () => {
    reset();
    onClose();
  };

  const trimmedUrl = url.trim();
  const canAdd = /^https?:\/\/\S+$/i.test(trimmedUrl);

  const submit = () => {
    if (!canAdd) return;
    onAdd({
      id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim() || KINDS.find((k) => k.id === kind)?.label || trimmedUrl,
      url: trimmedUrl,
      kind,
      createdAt: Date.now(),
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>デジタルリンクを追加</Text>
          <Text style={styles.hint}>
            この本についての AI 対話やドキュメントの URL を紐づけます。
          </Text>

          <View style={styles.kinds}>
            {KINDS.map((k) => {
              const on = k.id === kind;
              return (
                <TouchableOpacity
                  key={k.id}
                  style={[styles.kind, on && styles.kindOn]}
                  onPress={() => setKind(k.id)}
                >
                  <Text style={[styles.kindText, on && styles.kindTextOn]}>{k.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="ラベル（任意）"
            placeholderTextColor={COLORS.muted}
          />
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.ghost} onPress={close}>
              <Text style={styles.ghostText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primary, !canAdd && styles.disabled]}
              onPress={submit}
              disabled={!canAdd}
            >
              <Text style={styles.primaryText}>追加する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(25,29,27,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 12,
  },
  title: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  hint: { color: COLORS.muted, fontSize: 12.5, lineHeight: 19 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  kindOn: { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
  kindText: { color: COLORS.muted, fontSize: 12.5 },
  kindTextOn: { color: COLORS.accentBright, fontWeight: '700' },
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
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ghost: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
  },
  ghostText: { color: COLORS.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  primary: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
  },
  primaryText: { color: COLORS.onAccent, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.4 },
});
