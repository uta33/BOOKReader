import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { COLORS } from '../../constants/colors';
import { isBookIsbn, isJapaneseBooklandPriceCode, normalizeIsbn } from '../../services/isbn';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  // 検出後に同じフレームで何度も発火するのを止める。
  const lockedRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goManual = () => router.replace('/book/new');

  const onScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (lockedRef.current) return;
      const raw = result.data ?? '';

      // 日本の書籍はバーコードが2段。下段は価格コードで識別子ではない。
      if (isJapaneseBooklandPriceCode(raw)) {
        setNotice('それは下段の価格コードです。上段の 978 から始まるバーコードを読み取ってください。');
        return;
      }

      const isbn = normalizeIsbn(raw);
      if (!isbn || !isBookIsbn(isbn)) {
        setNotice('書籍のバーコードではないようです。上段の 978 から始まるバーコードを枠に合わせてください。');
        return;
      }

      lockedRef.current = true;
      setNotice(null);
      setBusy(true);
      router.replace({ pathname: '/book/new', params: { isbn } });
    },
    [router],
  );

  // 権限の状態が確定するまでは何も出さない。
  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ 戻る</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.permTitle}>カメラの許可が必要です</Text>
          <Text style={styles.permBody}>
            本の裏表紙のバーコードを読み取るためにカメラを使います。
            許可しない場合も、ISBN の手入力で登録できます。
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>カメラを許可する</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={goManual}>
            <Text style={styles.ghostBtnText}>手入力で登録する</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>バーコードをスキャン</Text>
      </View>

      <View style={styles.camWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
          onBarcodeScanned={busy ? undefined : onScanned}
        />

        <View style={styles.frame} pointerEvents="none" />

        <View style={styles.guide} pointerEvents="none">
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={COLORS.white} />
              <Text style={styles.guideText}>書誌情報を照会しています…</Text>
            </View>
          ) : notice ? (
            <Text style={styles.noticeText}>{notice}</Text>
          ) : (
            <Text style={styles.guideText}>
              本の裏表紙のバーコードは<Text style={styles.strong}>2段</Text>あります。
              読み取るのは<Text style={styles.strong}>上段の 978 から始まる方</Text>です。
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={goManual}>
          <Text style={styles.footerBtnText}>ISBNを手入力</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtn} onPress={goManual}>
          <Text style={styles.footerBtnText}>手で登録</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  back: { color: COLORS.accent, fontSize: 16 },
  title: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  permTitle: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  permBody: {
    color: COLORS.mutedLight,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  ghostBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  ghostBtnText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },

  camWrap: { flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  frame: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '34%',
    height: 96,
    borderWidth: 2,
    borderColor: COLORS.danger,
    borderRadius: 8,
  },
  guide: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 12,
    padding: 14,
  },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guideText: { color: COLORS.white, fontSize: 13, lineHeight: 21 },
  noticeText: { color: COLORS.danger, fontSize: 13, lineHeight: 21, fontWeight: '600' },
  strong: { color: COLORS.danger, fontWeight: '700' },

  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 20 },
  footerBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 13,
  },
  footerBtnText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
