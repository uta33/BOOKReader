import Anthropic from '@anthropic-ai/sdk';
// NOTE: '.js' extension is intentional — see api/tts.ts for why.
import { SUMMARY_MODEL } from './summary.js';

export interface QuizItem {
  q: string;
  a: string;
}

export interface QuizResult {
  quiz: QuizItem[];
  mock: boolean;
}

/** Parse "Q: …" / "A: …" line pairs into quiz items. */
export function parseQuizLines(text: string): QuizItem[] {
  const items: QuizItem[] = [];
  let pendingQ: string | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const qm = line.match(/^Q\d*[:：]\s*(.+)$/);
    const am = line.match(/^A\d*[:：]\s*(.+)$/);
    if (qm) {
      pendingQ = qm[1].trim();
    } else if (am && pendingQ) {
      items.push({ q: pendingQ, a: am[1].trim() });
      pendingQ = null;
    }
  }
  return items;
}

const GENERIC_QUIZ: QuizItem[] = [
  {
    q: 'この要約で最も重要な主張は何でしたか？自分の言葉で説明してください。',
    a: '要約の冒頭の一文と「まとめ」の行動項目を思い出せればOKです。台本を開いて確認しましょう。',
  },
];

/**
 * Generate 3 review-quiz questions from an imported summary script.
 * Returns a generic single question when ANTHROPIC_API_KEY is unset.
 */
export async function generateQuiz(script: string): Promise<QuizResult> {
  const text = script?.trim();
  if (!text) throw new Error('script is required');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { quiz: GENERIC_QUIZ, mock: true };

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          '次のビジネス書要約の内容について、記憶定着のための復習クイズを日本語で3問作成してください。',
          '核心となる考え方と、実務への適用方法を問う質問にしてください。',
          '出力は次の形式のみ（前置き・番号・その他の文は不要）:',
          'Q: <質問>',
          'A: <模範解答（2〜3文）>',
          '',
          '--- 要約 ---',
          text.slice(0, 12000),
        ].join('\n'),
      },
    ],
  });
  const out = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const quiz = parseQuizLines(out);
  return { quiz: quiz.length > 0 ? quiz : GENERIC_QUIZ, mock: false };
}
