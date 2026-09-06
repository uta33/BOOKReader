/**
 * プロンプトへ利用者のデータを載せるときの共通処理。
 *
 * 山括弧を潰すのは、資料が `</excerpts>` のような閉じタグを含んでいても
 * 区切りを偽装できないようにするため。指示と資料の境界はタグで示している。
 */
export function escapePromptData(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
