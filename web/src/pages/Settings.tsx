import { useEffect, useState } from 'react';
import {
  VOICES,
  PREVIEW_TEXT,
  QUALITIES,
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
import { backupFilename, buildBackup, restoreBackup } from '../services/backup';

const FONT_LABEL: Record<FontScale, string> = { s: '小', m: '中', l: '大' };

export function Settings() {
  const {
    voiceName,
    speedStepIdx,
    speakingRate,
    pitch,
    fontScale,
    obsidianVault,
    setVoice,
    setSpeedIdx,
    setPitch,
    setFontScale,
    setObsidianVault,
  } = useSettingsStore();
  const bgmEnabled = useBgmStore((s) => s.enabled);
  const bgmVolume = useBgmStore((s) => s.volume);
  const setBgmEnabled = useBgmStore((s) => s.setEnabled);
  const setBgmVolume = useBgmStore((s) => s.setVolume);

  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [previewing, setPreviewing] = useState(false);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const onExportBackup = () => {
    setBackupMsg(null);
    try {
      const { json, summary } = buildBackup();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setBackupMsg(`✅ 書き出しました（本 ${summary.books}冊・復習 ${summary.reviews}件）`);
    } catch (e) {
      setBackupMsg(`⚠ ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onImportBackup = async (file: File | undefined) => {
    if (!file) return;
    setBackupMsg(null);
    if (!confirm('現在のデータをバックアップの内容で上書きします。よろしいですか？')) return;
    try {
      const summary = restoreBackup(await file.text());
      alert(`復元しました（本 ${summary.books}冊・復習 ${summary.reviews}件）。アプリを再読み込みします。`);
      location.reload();
    } catch (e) {
      setBackupMsg(`⚠ ${e instanceof Error ? e.message : String(e)}`);
    }
  };

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
            {QUALITIES.map((q) => (
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
            最高音質（Chirp3 HD）は最も自然な読み上げです（利用料は高音質の約2倍、
            ピッチ調整は非対応で、文ハイライトは推定同期になります）。
            いずれもGoogle TTS（要APIキー）で、未設定時はブラウザ内蔵音声になります。
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
            読み上げ中だけ環境音をループ再生します（再生を止めるとBGMも止まります）。
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

        <label className="field">
          <span className="field__label">Obsidian Vault名（連携用・任意）</span>
          <input
            className="input"
            type="text"
            value={obsidianVault}
            onChange={(e) => setObsidianVault(e.target.value)}
            placeholder="未指定なら最後に開いたVaultに作成"
          />
          <p className="hint">
            リーダーの⋯メニュー「Obsidianにノート作成」で、ふりかえり・クイズ・要約が
            Vaultの「BOOKReader」フォルダにノートとして作成されます（Obsidianアプリが必要）。
          </p>
        </label>

        <div className="field">
          <span className="field__label">バックアップ</span>
          <div className="backup__actions">
            <button className="btn btn--primary" onClick={onExportBackup}>
              データを書き出す（JSON）
            </button>
            <label className="btn btn--ghost backup__import">
              バックアップから復元
              <input
                type="file"
                accept=".json,application/json"
                className="backup__file"
                onChange={(e) => {
                  void onImportBackup(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {backupMsg && <p className="hint">{backupMsg}</p>}
          <p className="hint">
            本・ふりかえり・復習スケジュール・学習記録・設定をすべて1つのファイルに保存します。
            機種変更やブラウザのデータ削除に備えて定期的に書き出してください
            （音声はファイルに含まれず、復元後に自動で再生成されます）。
          </p>
        </div>

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
