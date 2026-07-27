/**
 * 生成された要約テキストの整形。
 *
 * このファイルは `react-native` / `expo-*` / ストアを **import しない**
 * （`tsx` で直接テストできる状態を保つため）。
 */

/** web/server/lib/summary.ts が本文とクイズの間に挟むマーカー。 */
export const QUIZ_MARKER = '復習クイズ:';

/**
 * 生成結果から本文だけを取り出す。
 *
 * サーバーは「タイトル: …」の行 → 本文 → 「復習クイズ:」以降 の順で吐く。
 * READING NOTE では本文しか使わないので、前後を落とす。
 */
export function extractSummaryBody(raw: string): { title?: string; body: string } {
  const withoutQuiz = raw.split(QUIZ_MARKER)[0];
  const lines = withoutQuiz.split('\n');

  let title: string | undefined;
  const titleMatch = /^\s*タイトル\s*[:：]\s*(.+)$/.exec(lines[0] ?? '');
  if (titleMatch) {
    title = titleMatch[1].trim();
    lines.shift();
  }

  return { title, body: lines.join('\n').trim() };
}
