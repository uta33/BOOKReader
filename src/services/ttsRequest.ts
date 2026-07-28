import type { TTSOptions } from '../types/tts';

export function buildWorkerTtsRequest(text: string, options: TTSOptions) {
  return {
    text,
    voiceName: options.voiceName,
    speakingRate: options.speakingRate,
    pitch: options.pitch,
  };
}
