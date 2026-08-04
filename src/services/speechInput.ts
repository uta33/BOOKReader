export type SpeechInputErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'interrupted'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'busy'
  | 'client'
  | 'speech-timeout'
  | 'unknown';

/**
 * 音声認識結果は、既存の手入力を上書きせず次の行へ追記する。
 * 部分結果と確定結果のどちらにも同じ基準文字列を使うことで、
 * 認識イベントのたびに同じ文章が重複して増えるのを防ぐ。
 */
export function appendSpeechTranscript(existing: string, transcript: string): string {
  const spokenText = transcript.trim();
  if (!spokenText) return existing;

  const currentText = existing.trimEnd();
  if (!currentText) return spokenText;
  return `${currentText}\n${spokenText}`;
}

export function speechInputErrorMessage(code: SpeechInputErrorCode | string): string | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'マイクの使用が許可されていません。端末の設定でマイクを許可してください。';
    case 'language-not-supported':
      return 'この端末の音声認識は日本語に対応していません。キーボード入力をご利用ください。';
    case 'service-not-allowed':
      return 'この端末では音声認識サービスを利用できません。Google 音声認識などを有効にしてください。';
    case 'network':
      return '音声認識サービスへ接続できません。通信状態を確認して、もう一度お試しください。';
    case 'no-speech':
    case 'speech-timeout':
      return '音声を聞き取れませんでした。マイクに近づいて、もう一度お試しください。';
    case 'busy':
      return '音声認識が使用中です。少し待ってから、もう一度お試しください。';
    case 'audio-capture':
      return 'マイクを開始できませんでした。他の録音アプリを閉じて、もう一度お試しください。';
    case 'interrupted':
      return '通話などにより音声入力が中断されました。もう一度お試しください。';
    default:
      return '音声を文字にできませんでした。もう一度お試しください。';
  }
}
