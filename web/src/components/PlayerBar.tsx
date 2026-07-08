import { useEffect, useState } from 'react';
import { SPEED_STEPS } from '../constants/speeds';
import { QUALITIES, QUALITY_LABEL, VOICES, pickVoice, voiceQualityOf } from '../constants/voices';
import { useSettingsStore } from '../store/settingsStore';
import type { AudioMode } from '../hooks/useAudioPlayer';

interface Props {
  isPlaying: boolean;
  mode: AudioMode;
  total: number;
  currentIdx: number;
  /** Saved narration chunks / total chunks (audio is stored per chunk). */
  savedCount: number;
  chunkTotal: number;
  onToggle: () => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
  /** Generate (persist) the current chunk's audio without playing it. */
  onGenerateCurrent: () => Promise<void>;
}

const MODE_LABEL: Record<Exclude<AudioMode, 'tts'>, string> = {
  speech: 'ブラウザ音声',
  timed: '自動送り',
};

type GenState = 'idle' | 'loading' | 'done' | 'error';

const GEN_LABEL: Record<GenState, string> = {
  idle: '生成',
  loading: '生成中',
  done: '済み✓',
  error: '⚠失敗',
};

export function PlayerBar({
  isPlaying,
  mode,
  total,
  currentIdx,
  savedCount,
  chunkTotal,
  onToggle,
  onSkipForward,
  onSkipBack,
  onGenerateCurrent,
}: Props) {
  const { speedStepIdx, setSpeedIdx, voiceName, setVoice } = useSettingsStore();
  const cycleSpeed = () => setSpeedIdx((speedStepIdx + 1) % SPEED_STEPS.length);

  // For Google-TTS mode, reflect the actual voice quality (高音質 / 標準)
  // rather than always claiming "高品質".
  const quality = voiceQualityOf(voiceName);
  const modeLabel = mode === 'tts' ? `${QUALITY_LABEL[quality]}音声` : MODE_LABEL[mode];

  // Cycle 最高音質→高音質→標準 keeping the current voice's gender; shares
  // the settings store, so the Settings page stays in sync automatically.
  const toggleQuality = () => {
    const next = QUALITIES[(QUALITIES.indexOf(quality) + 1) % QUALITIES.length];
    setVoice(pickVoice(next, VOICES.find((v) => v.name === voiceName)?.gender));
  };

  const [genState, setGenState] = useState<GenState>('idle');
  const [genError, setGenError] = useState<string | null>(null);

  // Moving to a different sentence makes any prior done/error status stale.
  useEffect(() => {
    setGenState('idle');
    setGenError(null);
  }, [currentIdx]);

  const handleGenerate = async () => {
    setGenState('loading');
    setGenError(null);
    try {
      await onGenerateCurrent();
      setGenState('done');
    } catch (e) {
      setGenState('error');
      setGenError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="player">
      <div className="player__meta">
        <span>
          {currentIdx + 1} / {total}
        </span>
        <span className="player__mode" title="音声ソース">
          {modeLabel}
          {savedCount > 0 ? `・保存 ${Math.min(savedCount, chunkTotal)}/${chunkTotal}` : ''}
        </span>
      </div>
      <div className="player__controls">
        <button className="player__btn" onClick={onSkipBack} aria-label="前の文">
          ⏮
        </button>
        <button
          className="player__btn player__btn--main"
          onClick={onToggle}
          aria-label={isPlaying ? '一時停止' : '再生'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="player__btn" onClick={onSkipForward} aria-label="次の文">
          ⏭
        </button>
        <button className="player__btn player__btn--speed" onClick={cycleSpeed} aria-label="速度">
          {SPEED_STEPS[speedStepIdx]}x
        </button>
        <button
          className="player__btn player__btn--quality"
          onClick={toggleQuality}
          aria-label="音質切り替え"
          title="音質を切り替え（高音質⇄標準）。切り替え後は新しい声で音声が生成されます"
        >
          {QUALITY_LABEL[quality]}
        </button>
        <button
          className="player__btn player__btn--gen"
          onClick={handleGenerate}
          disabled={genState === 'loading'}
          aria-label="この段落の音声だけ生成する（再生はしない）"
          title="この段落の音声だけ生成する（再生はしない）"
        >
          {GEN_LABEL[genState]}
        </button>
      </div>
      {genState === 'error' && genError && <div className="player__gen-error">{genError}</div>}
    </div>
  );
}
