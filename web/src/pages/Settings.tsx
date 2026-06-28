import { useState } from 'react';
import { VOICES, PREVIEW_TEXT } from '../constants/voices';
import { SPEED_STEPS } from '../constants/speeds';
import { useSettingsStore } from '../store/settingsStore';
import { synthesize } from '../services/api';

export function Settings() {
  const { voiceName, speedStepIdx, speakingRate, pitch, setVoice, setSpeedIdx, setPitch } =
    useSettingsStore();
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [previewing, setPreviewing] = useState(false);

  const voices = VOICES.filter((v) => genderFilter === 'all' || v.gender === genderFilter);

  const preview = async () => {
    setPreviewing(true);
    try {
      const resp = await synthesize(PREVIEW_TEXT, voiceName, speakingRate, pitch);
      if (!resp.fallback) {
        const audio = new Audio(`data:audio/mp3;base64,${resp.audioContent}`);
        await audio.play();
      } else if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(PREVIEW_TEXT);
        u.lang = 'ja-JP';
        u.rate = Math.min(2, Math.max(0.5, speakingRate));
        u.pitch = 1 + pitch / 10;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch {
      /* ignore preview errors */
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="page">
      <header className="appbar">
        <h1 className="appbar__title">設定</h1>
      </header>

      <div className="form">
        <div className="field">
          <span className="field__label">声フィルター</span>
          <div className="segmented">
            {(['all', 'female', 'male'] as const).map((g) => (
              <button
                key={g}
                className={`segmented__btn${genderFilter === g ? ' is-active' : ''}`}
                onClick={() => setGenderFilter(g)}
              >
                {g === 'all' ? 'すべて' : g === 'female' ? '女性' : '男性'}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">声</span>
          <div className="voicelist">
            {voices.map((v) => (
              <button
                key={v.name}
                className={`voice${voiceName === v.name ? ' is-active' : ''}`}
                onClick={() => setVoice(v.name)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field__label">速度: {SPEED_STEPS[speedStepIdx]}x</span>
          <input
            type="range"
            min={0}
            max={SPEED_STEPS.length - 1}
            step={1}
            value={speedStepIdx}
            onChange={(e) => setSpeedIdx(Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span className="field__label">ピッチ: {pitch.toFixed(1)}</span>
          <input
            type="range"
            min={-10}
            max={10}
            step={1}
            value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
          />
        </label>

        <button className="btn btn--primary" onClick={preview} disabled={previewing}>
          {previewing ? '再生中…' : '試聴する'}
        </button>

        <p className="hint">
          高品質音声（Google TTS）はサーバ側でAPIキーを設定すると有効になります。未設定時はブラウザ内蔵の音声で読み上げます。
        </p>
      </div>
    </div>
  );
}
