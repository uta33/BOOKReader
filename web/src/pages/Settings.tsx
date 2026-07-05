import { useEffect, useState } from 'react';
import {
  VOICES,
  PREVIEW_TEXT,
  QUALITY_LABEL,
  pickVoice,
  voiceQualityOf,
  type VoiceQuality,
} from '../constants/voices';
import { SPEED_STEPS } from '../constants/speeds';
import { useSettingsStore, type FontScale } from '../store/settingsStore';
import { useBgmStore } from '../store/bgmStore';
import { synthesize } from '../services/api';
import { getStorageInfo, type StorageInfo } from '../services/audioCache';

const FONT_LABEL: Record<FontScale, string> = { s: '小', m: '中', l: '大' };

export function Settings() {
  const {
    voiceName,
    speedStepIdx,
    speakingRate,
    pitch,
    fontScale,
    setVoice,
    setSpeedIdx,
    setPitch,
    setFontScale,
  } = useSettingsStore();
  const bgmEnabled = useBgmStore((s) => s.enabled);
  const bgmVolume = useBgmStore((s) => s.volume);
  const setBgmEnabled = useBgmStore((s) => s.setEnabled);
  const setBgmVolume = useBgmStore((s) => s.setVolume);

  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [previewing, setPreviewing] = useState(false);
  const [storage, setStorage] = useState<StorageInfo | null>(null);

  useEffect(() => {
    void getStorageInfo().then(setStorage);
  }, []);

  const quality = voiceQualityOf(voiceName);
  const currentGender = VOICES.find((v) => v.name === voiceName)?.gender;

  // Switching quality immediately selects a matching voice (keeping gender when
  // possible), so choosing 高音質 actually takes effect right away.
  const changeQuality = (q: VoiceQuality) => {
    if (q === quality) return;
    setVoice(pickVoice(q, currentGender));
  };

  // Changing the gender filter also re-picks a matching voice at the same
  // quality, so the selection never drifts out of the visible list.
  const changeGender = (g: 'all' | 'female' | 'male') => {
    setGenderFilter(g);
    if (g !== 'all' && currentGender !== g) setVoice(pickVoice(quality, g));
  };

  const voices = VOICES.filter(
    (v) => v.quality === quality && (genderFilter === 'all' || v.gender === genderFilter),
  );

  const preview = async () => {
    setPreviewing(true);
    try {
      const resp = await synthesize(PREVIEW_TEXT, voiceName, 1.0, pitch);
      if (!resp.fallback) {
        const audio = new Audio(`data:audio/mp3;base64,${resp.audioContent}`);
        audio.playbackRate = speakingRate;
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
          <span className="field__label">リーダーの文字サイズ</span>
          <div className="segmented">
            {(['s', 'm', 'l'] as const).map((f) => (
              <button
                key={f}
                className={`segmented__btn${fontScale === f ? ' is-active' : ''}`}
                onClick={() => setFontScale(f)}
              >
                {FONT_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">音質</span>
          <div className="segmented">
            {(['neural2', 'standard'] as const).map((q) => (
              <button
                key={q}
                className={`segmented__btn${quality === q ? ' is-active' : ''}`}
                onClick={() => changeQuality(q)}
              >
                {QUALITY_LABEL[q]}
              </button>
            ))}
          </div>
          <p className="hint">
            高音質（Neural2）はより自然な読み上げです。どちらもGoogle TTS（要APIキー）で、
            未設定時はブラウザ内蔵音声になります。
          </p>
        </div>

        <div className="field">
          <span className="field__label">声フィルター</span>
          <div className="segmented">
            {(['all', 'female', 'male'] as const).map((g) => (
              <button
                key={g}
                className={`segmented__btn${genderFilter === g ? ' is-active' : ''}`}
                onClick={() => changeGender(g)}
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
          <p className="hint">
            音声は声ごとに保存されます。声を切り替えると新しい声での再生成が必要になります
            （速度の変更は保存済み音声にそのまま反映されます）。
          </p>
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

        <div className="field">
          <span className="field__label">バックグラウンド音（BGM）</span>
          <div className="segmented">
            <button
              className={`segmented__btn${bgmEnabled ? ' is-active' : ''}`}
              onClick={() => setBgmEnabled(true)}
            >
              オン
            </button>
            <button
              className={`segmented__btn${!bgmEnabled ? ' is-active' : ''}`}
              onClick={() => setBgmEnabled(false)}
            >
              オフ
            </button>
          </div>
          <p className="hint">
            読み上げと同時に環境音をループ再生します。オンにしたあと画面を一度タップすると再生が始まります
            （ブラウザの自動再生制限のため）。
          </p>
        </div>

        {bgmEnabled && (
          <label className="field">
            <span className="field__label">BGMの音量: {Math.round(bgmVolume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(bgmVolume * 100)}
              onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
            />
          </label>
        )}

        {storage && (
          <div className="field">
            <span className="field__label">保存済み音声のストレージ</span>
            <p className="hint">
              使用量 {storage.usageMB.toFixed(1)} MB / 上限 約{Math.round(storage.quotaMB)} MB ・
              永続化: {storage.persisted ? '有効（自動削除されません）' : '未設定（音声保存時に要求します）'}
            </p>
          </div>
        )}

        <p className="hint">
          高品質音声（Google TTS）はサーバ側でAPIキーを設定すると有効になります。未設定時はブラウザ内蔵の音声で読み上げます。
        </p>
      </div>
    </div>
  );
}
