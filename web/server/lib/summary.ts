import Anthropic from '@anthropic-ai/sdk';

export interface GenerateInput {
  /** Book title or topic the user wants a summary script for. */
  topic: string;
  /** Optional extra guidance (focus, audience, angle). */
  guidance?: string;
}

/** Summary-generation model. User-selected default: Sonnet. */
export const SUMMARY_MODEL = process.env.SUMMARY_MODEL ?? 'claude-sonnet-4-6';

export const QUIZ_MARKER = '復習クイズ:';

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
    '- 本文の末尾に「まとめ」として、明日から実行できる行動を2〜3個。',
    '',
    '朗読のなめらかさ（最重要）:',
    '- これはナレーターがそのまま朗読する台本。耳で聴いて自然な「話し言葉」の日本語で書く。',
    '- 「です・ます」調で統一し、一文は60文字以内を目安に短くする。長い文は2文に分ける。',
    '- 文と文は「そして」「しかし」「たとえば」「つまり」などで滑らかにつなぎ、体言止めは使わない。',
    '- 箇条書き記号(・,-,*)・Markdown記法・括弧書き・記号・英字の羅列を使わない。',
    '- 略語や英単語は読み上げやすいカタカナで書く（例: KPI→ケーピーアイ、ROI→アールオーアイ）。',
    '- 数字は耳で聞いて分かる形にする（例: 「3つ」「2020年」）。',
    '- 演出・読み方の指示や注釈（「ナレーション:」「（間）」「※」「BGM」「効果音」など）は一切書かない。',
    '  本文には朗読される言葉だけを書く。',
    '- 文は句点（。）で区切れる自然な文章にする。',
    '',
    '出力フォーマット:',
    '1行目に「タイトル: <書名/トピックを表す簡潔な題>」。',
    '2行目以降に本文。',
    `本文が終わったら、最後に「${QUIZ_MARKER}」という行を置き、続けて内容の核心を問う復習クイズを3問、`,
    '次の形式で出力する（クイズは本文には含めない）:',
    'Q: <質問>',
    'A: <模範解答（2〜3文）>',
  ]
    .filter(Boolean)
    .join('\n');
}

function mockText({ topic }: GenerateInput): string {
  const title = topic.slice(0, 40);
  return [
    `タイトル: ${title}`,
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
    '',
    QUIZ_MARKER,
    'Q: 時間を投資すべきなのはどの領域ですか？',
    'A: 重要だが緊急でない領域です。緊急なタスクに追われる前に、成果に直結する仕事へ意図的に時間を確保します。',
    'Q: 意思決定の質を保つために何をすべきですか？',
    'A: 繰り返す判断をルール化して意思決定の回数を減らします。エネルギーを本当に重要な決定に温存できます。',
    'Q: 新しい取り組みを始めるときの原則は何ですか？',
    'A: 小さく試して素早く学ぶことです。最小限の形で検証し、結果を見てから拡大することで失敗の損失を抑えます。',
  ].join('\n');
}

/**
 * Stream a business-book summary script (plain text) chunk by chunk.
 * Output format: "タイトル: …" line, body, then a QUIZ_MARKER section with
 * 3 Q:/A: pairs. Falls back to a deterministic mock when ANTHROPIC_API_KEY is
 * not configured so the UI works without credentials.
 */
export async function* generateSummaryStream(input: GenerateInput): AsyncGenerator<string> {
  const topic = input.topic?.trim();
  if (!topic) throw new Error('topic is required');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Emit the mock in small chunks so the client's live view behaves the same.
    const text = mockText({ ...input, topic });
    const CHUNK = 80;
    for (let i = 0; i < text.length; i += CHUNK) {
      yield text.slice(i, i + CHUNK);
      await new Promise((r) => setTimeout(r, 15));
    }
    return;
  }

  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: SUMMARY_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: buildPrompt({ ...input, topic }) }],
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

export function isMockMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}
