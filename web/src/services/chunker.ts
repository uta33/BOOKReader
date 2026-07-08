import type { Sentence } from '../types/book';

/**
 * Group sentences into narration chunks. Each chunk is synthesized as ONE
 * continuous TTS request (with an SSML <mark> per sentence for highlight
 * sync), so the audio has natural prosody across sentences and far fewer
 * audible seams than per-sentence clips.
 */
export interface Chunk {
  /** Stable id derived from the sentence span, e.g. "c0_11". */
  id: string;
  startIdx: number;
  endIdx: number;
  sentences: Sentence[];
}

/**
 * Upper bound of Japanese characters per chunk. ~400 chars ≈ 1 minute of
 * speech — long enough that boundaries are rare, short enough to keep TTS
 * latency and clip size reasonable (Google's request limit is 5000 bytes).
 */
export const CHUNK_CHAR_LIMIT = 400;

export function buildChunks(sentences: Sentence[]): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Sentence[] = [];
  let chars = 0;
  let start = 0;

  const flush = (endIdx: number) => {
    if (current.length === 0) return;
    chunks.push({ id: `c${start}_${endIdx}`, startIdx: start, endIdx, sentences: current });
    current = [];
    chars = 0;
  };

  sentences.forEach((s, i) => {
    // Headings start a fresh chunk so chapters begin on a clean boundary.
    if (current.length > 0 && (s.isHeading || chars + s.text.length > CHUNK_CHAR_LIMIT)) {
      flush(i - 1);
    }
    if (current.length === 0) start = i;
    current.push(s);
    chars += s.text.length;
  });
  flush(sentences.length - 1);
  return chunks;
}

/** Index of the chunk containing the given global sentence index (-1 if none). */
export function chunkIndexFor(chunks: Chunk[], sentenceIdx: number): number {
  return chunks.findIndex((c) => sentenceIdx >= c.startIdx && sentenceIdx <= c.endIdx);
}

// Character-proportional position estimates — the fallback used when the TTS
// voice can't return SSML-mark timepoints (Chirp3-HD). Japanese narration
// pace is close to uniform per character, so this tracks well in practice.

/** Estimated start time (s) of a sentence within its chunk's audio. */
export function estimatedStartSeconds(
  chunk: Chunk,
  globalIdx: number,
  durationSeconds: number,
): number {
  const total = chunk.sentences.reduce((n, s) => n + s.text.length, 0) || 1;
  const before = chunk.sentences
    .slice(0, Math.max(0, globalIdx - chunk.startIdx))
    .reduce((n, s) => n + s.text.length, 0);
  return (before / total) * durationSeconds;
}

/** Estimated global sentence index at a playback position within a chunk. */
export function sentenceIndexAtTimeEstimate(
  chunk: Chunk,
  timeSeconds: number,
  durationSeconds: number,
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return chunk.startIdx;
  const total = chunk.sentences.reduce((n, s) => n + s.text.length, 0) || 1;
  const target = (timeSeconds / durationSeconds) * total;
  let acc = 0;
  for (let i = 0; i < chunk.sentences.length; i++) {
    acc += chunk.sentences[i].text.length;
    if (target < acc) return chunk.startIdx + i;
  }
  return chunk.endIdx;
}
