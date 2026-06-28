import Anthropic from '@anthropic-ai/sdk';

export interface GenerateInput {
  /** Book title or topic the user wants a summary script for. */
  topic: string;
  /** Optional extra guidance (focus, audience, angle). */
  guidance?: string;
}

export interface GenerateResult {
  title: string;
  script: string;
  /** true when no API key was configured and a mock script was returned. */
  mock: boolean;
}

const MODEL = 'claude-opus-4-8';

function buildPrompt({ topic, guidance }: GenerateInput): string {
  return [
    `次のビジネス書（またはトピック）の「要約台本」を日本語で作成してください。`,
    `対象: ${topic}`,
    guidance ? `補足の方針: ${guidance}` : '',
    '',
    '要件:',
    '- 15〜20分で聴ける長さ（おおよそ1800〜2600字）。',
    '- 構成: 冒頭に1文の要約、続いて3〜5個の重要ポイントを章立てで。',
    '- 各章は「第N章 タイトル」の見出し1行のあと、本文を続ける。',
    '- 各章に、具体的なビジネス現場での適用例を1つ含める。',
    '- 末尾に「まとめ」として、明日から実行できる行動を2〜3個。',
    '- 音声読み上げ前提のプレーンな日本語。箇条書き記号(・,-,*)やMarkdown記法は使わない。',
    '- 文は句点（。）で区切れる自然な文章にする。',
    '',
    '出力フォーマット:',
    '1行目に「タイトル: <書名/トピックを表す簡潔な題>」。',
    '2行目以降に本文のみ。',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseTitle(text: string, fallback: string): { title: string; script: string } {
  const lines = text.split('\n');
  const first = lines[0]?.trim() ?? '';
  const m = first.match(/^タイトル[:：]\s*(.+)$/);
  if (m) {
    return { title: m[1].trim(), script: lines.slice(1).join('\n').trim() };
  }
  return { title: fallback, script: text.trim() };
}

function mockScript({ topic }: GenerateInput): GenerateResult {
  const title = topic.slice(0, 40);
  const script = [
    `${topic}は、限られた時間で成果を最大化するための考え方を扱います。`,
    '',
    '第1章 重要なことに集中する',
    `多くの人は緊急なタスクに追われ、本当に重要な仕事を後回しにしてしまいます。重要度と緊急度を分けて考え、重要だが緊急でない領域に時間を投資することが鍵です。たとえば営業チームでは、目先の対応に追われる前に、毎朝30分を顧客分析にあてることで成約率が改善します。`,
    '',
    '第2章 仕組みで意思決定を減らす',
    `意思決定の回数が増えるほど判断の質は下がります。繰り返す判断はルール化し、エネルギーを重要な決定に温存しましょう。たとえば経費承認の基準を明文化すれば、上長の確認を待つ時間がなくなり、現場の意思決定が速くなります。`,
    '',
    '第3章 小さく試して学ぶ',
    `完璧な計画より、小さく試して素早く学ぶ方が成果につながります。仮説を立て、最小限の形で検証し、結果から次の一手を決めます。新規事業では、いきなり大きく投資せず、一部の顧客に限定して提供し、反応を見てから拡大すると失敗の損失を抑えられます。`,
    '',
    'まとめ',
    `第一に、今週の重要だが緊急でないタスクを一つ決めて時間を確保しましょう。第二に、繰り返す判断を一つ選んでルール化しましょう。第三に、温めているアイデアを最小限の形で試してみましょう。`,
  ].join('\n');
  return { title, script, mock: true };
}

/**
 * Generate a business-book summary script with Claude.
 * Falls back to a deterministic mock when ANTHROPIC_API_KEY is not configured,
 * so the UI is fully usable without credentials.
 */
export async function generateSummary(input: GenerateInput): Promise<GenerateResult> {
  const topic = input.topic?.trim();
  if (!topic) throw new Error('topic is required');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return mockScript(input);

  const client = new Anthropic({ apiKey });
  // Stream to avoid HTTP timeouts on long generations; collect the final message.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: buildPrompt({ ...input, topic }) }],
  });
  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const { title, script } = parseTitle(text, topic.slice(0, 40));
  return { title, script, mock: false };
}
