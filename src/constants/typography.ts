import { Platform } from 'react-native';

/**
 * 書体は役割で分ける。
 *
 * 明朝 — 引用・抜き書き・本文（読むもの）
 * ゴシック — UI・ラベル・数値（操作するもの）
 *
 * 日本語の埋め込みフォントは数MB規模になるので、システムフォントを使う。
 * 題材の上でもこの対が正しい。
 */
export const FONTS = {
  /** 明朝。RN の既定ファミリ名で解決する。 */
  mincho: Platform.select({
    android: 'serif',
    ios: 'Hiragino Mincho ProN',
    default: 'serif',
  }),
  /** ゴシックは RN の既定なので指定しない（undefined を渡すと既定になる）。 */
  gothic: undefined as string | undefined,
};

/** 引用・抜き書きに使う明朝のスタイル。 */
export const QUOTE_TEXT = {
  fontFamily: FONTS.mincho,
  fontSize: 15,
  lineHeight: 26,
} as const;

/** 見出し（書名など）に使う明朝のスタイル。 */
export const TITLE_TEXT = {
  fontFamily: FONTS.mincho,
  fontSize: 19,
  lineHeight: 27,
} as const;
