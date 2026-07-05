export type VoiceQuality = 'standard' | 'neural2';

export interface VoiceOption {
  label: string;
  name: string;
  gender: 'female' | 'male';
  quality: VoiceQuality;
}

// Quality tiers exposed in the UI: 高音質 = Neural2, 標準 = Standard.
export const VOICES: VoiceOption[] = [
  { label: '女性A', name: 'ja-JP-Standard-A', gender: 'female', quality: 'standard' },
  { label: '女性B', name: 'ja-JP-Standard-C', gender: 'female', quality: 'standard' },
  { label: '男性', name: 'ja-JP-Standard-D', gender: 'male', quality: 'standard' },
  { label: '女性', name: 'ja-JP-Neural2-B', gender: 'female', quality: 'neural2' },
  { label: '男性', name: 'ja-JP-Neural2-C', gender: 'male', quality: 'neural2' },
];

export const QUALITY_LABEL: Record<VoiceQuality, string> = {
  neural2: '高音質',
  standard: '標準',
};

export const DEFAULT_VOICE = 'ja-JP-Neural2-B';
export const PREVIEW_TEXT = 'こんにちは。これはテスト音声です。速さとピッチをご確認ください。';

export function voiceQualityOf(name: string): VoiceQuality {
  return VOICES.find((v) => v.name === name)?.quality ?? 'neural2';
}

/** Pick a voice of the given quality, preferring the requested gender. */
export function pickVoice(quality: VoiceQuality, gender?: 'female' | 'male'): string {
  const byGender = gender && VOICES.find((v) => v.quality === quality && v.gender === gender);
  return (byGender ?? VOICES.find((v) => v.quality === quality) ?? VOICES[0]).name;
}
