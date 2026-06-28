import { SPEED_STEPS } from '../constants/speeds';
import { useSettingsStore } from '../store/settingsStore';
import type { AudioMode } from '../hooks/useAudioPlayer';

interface Props {
  isPlaying: boolean;
  mode: AudioMode;
  prefetched: number;
  total: number;
  currentIdx: number;
  onToggle: () => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
}

const MODE_LABEL: Record<AudioMode, string> = {
  tts: '高品質音声',
  speech: 'ブラウザ音声',
  timed: '自動送り',
};

export function PlayerBar({
  isPlaying,
  mode,
  prefetched,
  total,
  currentIdx,
  onToggle,
  onSkipForward,
  onSkipBack,
}: Props) {
  const { speedStepIdx, setSpeedIdx } = useSettingsStore();
  const cycleSpeed = () => setSpeedIdx((speedStepIdx + 1) % SPEED_STEPS.length);

  return (
    <div className="player">
      <div className="player__meta">
        <span>
          {currentIdx + 1} / {total}
        </span>
        <span className="player__mode" title="音声ソース">
          {MODE_LABEL[mode]}
          {mode === 'tts' && prefetched < total ? `（生成中 ${prefetched}/${total}）` : ''}
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
      </div>
    </div>
  );
}
