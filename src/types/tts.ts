export interface TTSOptions {
  voiceName: string;
  speakingRate: number;
  pitch: number;
}

export interface CachedAudio {
  sentenceId: string;
  filePath: string;
}
