export type VoiceQuality = 'standard' | 'neural2' | 'chirp3';

export interface VoiceOption {
  label: string;
  name: string;
  gender: 'female' | 'male';
  quality: VoiceQuality;
}

// Quality tiers exposed in the UI: 最高音質 = Chirp3-HD, 高音質 = Neural2,
// 標準 = Standard. Chirp3-HD does NOT support SSML/pitch/speakingRate — the
// server synthesizes plain text and the client estimates sentence positions
// from character offsets (speed still works via client-side playbackRate).
export const VOICES: VoiceOption[] = [
  { label: '女性A', name: 'ja-JP-Standard-A', gender: 'female', quality: 'standard' },
  { label: '女性B', name: 'ja-JP-Standard-C', gender: 'female', quality: 'standard' },
  { label: '男性', name: 'ja-JP-Standard-D', gender: 'male', quality: 'standard' },
  { label: '女性', name: 'ja-JP-Neural2-B', gender: 'female', quality: 'neural2' },
  { label: '男性', name: 'ja-JP-Neural2-C', gender: 'male', quality: 'neural2' },
  { label: '女性A', name: 'ja-JP-Chirp3-HD-Aoede', gender: 'female', quality: 'chirp3' },
  { label: '女性B', name: 'ja-JP-Chirp3-HD-Kore', gender: 'female', quality: 'chirp3' },
  { label: '男性A', name: 'ja-JP-Chirp3-HD-Charon', gender: 'male', quality: 'chirp3' },
  { label: '男性B', name: 'ja-JP-Chirp3-HD-Puck', gender: 'male', quality: 'chirp3' },
];

export const QUALITY_LABEL: Record<VoiceQuality, string> = {
  chirp3: '最高音質',
  neural2: '高音質',
  standard: '標準',
};

/** Display / cycle order: best first. */
export const QUALITIES: VoiceQuality[] = ['chirp3', 'neural2', 'standard'];

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
