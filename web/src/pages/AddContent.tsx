import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateSummary } from '../services/api';
import { buildSentences } from '../services/sentenceSplitter';
import { useLibraryStore } from '../store/libraryStore';
import type { Book } from '../types/book';

type Tab = 'ai' | 'script';

export function AddContent() {
  const [tab, setTab] = useState<Tab>('ai');
  const [topic, setTopic] = useState('');
  const [guidance, setGuidance] = useState('');
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const addBook = useLibraryStore((s) => s.addBook);
  const navigate = useNavigate();

  const save = (title: string, script: string, source: Book['source'], topicVal?: string) => {
    const sentences = buildSentences(script);
    if (sentences.length === 0) {
      setError('テキストから文を抽出できませんでした。');
      return;
    }
    const book: Book = {
      id: `b${Date.now()}`,
      title: title.trim() || '無題',
      source,
      topic: topicVal,
      sentences,
      lastSentenceIdx: 0,
      createdAt: Date.now(),
    };
    addBook(book);
    navigate(`/reader/${book.id}`);
  };

  const onGenerate = async () => {
    if (!topic.trim()) {
      setError('書名またはトピックを入力してください。');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await generateSummary(topic.trim(), guidance.trim() || undefined);
      if (res.mock) {
        setNotice('APIキー未設定のためサンプル台本を生成しました（本番ではClaudeが生成します）。');
      }
      save(res.title, res.script, 'ai', topic.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const onImport = () => {
    if (!scriptText.trim()) {
      setError('要約台本のテキストを貼り付けてください。');
      return;
    }
    setError(null);
    save(scriptTitle, scriptText, 'script');
  };

  return (
    <div className="page">
      <header className="appbar appbar--back">
        <button className="appbar__back" onClick={() => navigate(-1)} aria-label="戻る">
          ‹
        </button>
        <h1 className="appbar__title">コンテンツを追加</h1>
      </header>

      <div className="tabs">
        <button
          className={`tab${tab === 'ai' ? ' is-active' : ''}`}
          onClick={() => setTab('ai')}
        >
          🤖 AIで生成
        </button>
        <button
          className={`tab${tab === 'script' ? ' is-active' : ''}`}
          onClick={() => setTab('script')}
        >
          📝 台本を取り込み
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {notice && <div className="alert">{notice}</div>}

      {tab === 'ai' ? (
        <div className="form">
          <label className="field">
            <span className="field__label">書名 / トピック</span>
            <input
              className="input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例: エッセンシャル思考"
            />
          </label>
          <label className="field">
            <span className="field__label">補足の方針（任意）</span>
            <input
              className="input"
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="例: マネージャー向けに、実践例を多めに"
            />
          </label>
          <button className="btn btn--primary" onClick={onGenerate} disabled={loading}>
            {loading ? '生成中…' : '要約台本を生成'}
          </button>
          <p className="hint">
            ビジネス書を15〜20分で聴ける要約台本にします。生成後すぐに読み・聴き始められます。
          </p>
        </div>
      ) : (
        <div className="form">
          <label className="field">
            <span className="field__label">タイトル（任意）</span>
            <input
              className="input"
              value={scriptTitle}
              onChange={(e) => setScriptTitle(e.target.value)}
              placeholder="例: 7つの習慣 要約"
            />
          </label>
          <label className="field">
            <span className="field__label">要約台本のテキスト</span>
            <textarea
              className="input textarea"
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="ここに要約のテキストを貼り付け…"
              rows={12}
            />
          </label>
          <button className="btn btn--primary" onClick={onImport}>
            取り込む
          </button>
        </div>
      )}
    </div>
  );
}
