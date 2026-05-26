export interface VoiceOption {
  label: string;
  name: string;
  gender: 'female' | 'male';
  quality: 'standard' | 'neural2';
}

export const VOICES: VoiceOption[] = [
  { label: '女性A (Standard)', name: 'ja-JP-Standard-A', gender: 'female', quality: 'standard' },
  { label: '女性B (Neural2)', name: 'ja-JP-Neural2-B', gender: 'female', quality: 'neural2' },
  { label: '女性C (Standard)', name: 'ja-JP-Standard-C', gender: 'female', quality: 'standard' },
  { label: '男性D (Neural2)', name: 'ja-JP-Neural2-C', gender: 'male', quality: 'neural2' },
  { label: '男性D (Standard)', name: 'ja-JP-Standard-D', gender: 'male', quality: 'standard' },
];

export const DEFAULT_VOICE = 'ja-JP-Neural2-B';
export const PREVIEW_TEXT = 'こんにちは。これはテスト音声です。速さとピッチをご確認ください。';
