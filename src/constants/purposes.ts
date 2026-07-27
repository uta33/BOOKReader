/**
 * READING NOTE の「10の目的」。
 *
 * id は書籍レコードに永続化されるので、改名・再採番してはいけない。
 * ラベルの文言だけなら安全に変えられる。
 */
export const PURPOSES = [
  { id: 'volume', label: '読書量を増やす', emoji: '📈' },
  { id: 'record', label: '読書を記録する', emoji: '✍️' },
  { id: 'summarize', label: '読書をまとめる', emoji: '🗂' },
  { id: 'practice', label: '読書を実践する', emoji: '🏃' },
  { id: 'people', label: '読書で人と出会う', emoji: '🤝' },
  { id: 'bookstore', label: '書店と出会う', emoji: '🏬' },
  { id: 'discover', label: '本と出会う', emoji: '🔍' },
  { id: 'thinking', label: '思考を広げる', emoji: '💡' },
  { id: 'ownbook', label: '自分だけの一冊を作る', emoji: '📕' },
  { id: 'newself', label: '新しい自分と出会う', emoji: '🌱' },
] as const satisfies readonly { id: string; label: string; emoji: string }[];

export type PurposeId = (typeof PURPOSES)[number]['id'];

const PURPOSE_IDS = new Set<string>(PURPOSES.map((p) => p.id));

export function isPurposeId(value: unknown): value is PurposeId {
  return typeof value === 'string' && PURPOSE_IDS.has(value);
}

export function purposeLabel(id: PurposeId): string {
  return PURPOSES.find((p) => p.id === id)?.label ?? id;
}

export function purposeEmoji(id: PurposeId): string {
  return PURPOSES.find((p) => p.id === id)?.emoji ?? '·';
}
