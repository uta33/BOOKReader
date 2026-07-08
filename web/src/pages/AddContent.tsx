import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateQuiz, generateSummaryStream } from '../services/api';
import { parseGeneratedScript } from '../services/scriptParser';
import { buildSentences } from '../services/sentenceSplitter';
import { extractPdfText } from '../services/pdfExtract';
import { useLibraryStore } from '../store/libraryStore';
import type { Book, QuizItem } from '../types/book';

type Tab = 'ai' | 'script';

export function AddContent() {
  const [tab, setTab] = useState<Tab>('ai');
  const [topic, setTopic] = useState('');
  const [guidance, setGuidance] = useState('');
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addBook = useLibraryStore((s) => s.addBook);
  const navigate = useNavigate();

  const liveRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [liveText]);

  const save = (
    title: string,
    body: string,
    source: Book['source'],
    quiz: QuizItem[],
    topicVal?: string,
  ): boolean => {
    const sentences = buildSentences(body);
    if (sentences.length === 0) {
      setError('テキストから文を抽出できませんでした。');
      return false;
    }
    const book: Book = {
      id: `b${Date.now()}`,
      title: title.trim() || '無題',
      source,
      topic: topicVal,
      sentences,
      lastSentenceIdx: 0,
      createdAt: Date.now(),
      ...(quiz.length > 0 ? { quiz } : {}),
    };
    addBook(book);
    navigate(`/reader/${book.id}`);
    return true;
  };

  const onGenerate = async () => {
    const t = topic.trim();
    if (!t) {
      setError('書名またはトピックを入力してください。');
      return;
    }
    setError(null);
    setLiveText('');
    setLoading(true);
    try {
      const full = await generateSummaryStream(t, guidance.trim() || undefined, setLiveText);
      const parsed = parseGeneratedScript(full, t.slice(0, 40));
      save(parsed.title, parsed.body, 'ai', parsed.quiz, t);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    try {
      let text: string;
      if (isPdf) {
        // Text layer extracted in the browser; scanned PDFs fall back to
        // page-image OCR (server-side Cloud Vision, handles 縦書き).
        setExtracting('PDFからテキストを抽出しています…');
        text = await extractPdfText(file, ({ phase, page, total }) =>
          setExtracting(
            phase === 'ocr'
              ? `スキャンPDFを文字認識（OCR）中… ${page}/${total}ページ`
              : `PDFからテキストを抽出しています… ${page}/${total}ページ`,
          ),
        );
      } else {
        text = await file.text();
      }
      if (!text.trim()) {
        setError('ファイルが空です。');
        return;
      }
      setScriptText(text);
      setFileName(file.name);
      if (!scriptTitle.trim()) {
        setScriptTitle(file.name.replace(/\.(md|markdown|txt|pdf)$/i, ''));
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'ファイルの読み込みに失敗しました。',
      );
    } finally {
      setExtracting(null);
    }
  };

  const onImport = async () => {
    const text = scriptText.trim();
    if (!text) {
      setError('ファイルを選択してください。');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Content-specific review questions for imported scripts, too.
      // Import still succeeds if quiz generation fails.
      let quiz: QuizItem[] = [];
      try {
        quiz = (await generateQuiz(text)).quiz;
      } catch {
        quiz = [];
      }
      const parsed = parseGeneratedScript(text, scriptTitle.trim() || '無題');
      save(scriptTitle.trim() || parsed.title, parsed.body, 'script', quiz);
    } finally {
      setLoading(false);
    }
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
          disabled={loading}
        >
          🤖 AIで生成
        </button>
        <button
          className={`tab${tab === 'script' ? ' is-active' : ''}`}
          onClick={() => setTab('script')}
          disabled={loading}
        >
          📝 台本を取り込み
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {tab === 'ai' ? (
        <div className="form">
          <label className="field">
            <span className="field__label">書名 / トピック</span>
            <input
              className="input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例: エッセンシャル思考"
              disabled={loading}
            />
          </label>
          <label className="field">
            <span className="field__label">補足の方針（任意）</span>
            <input
              className="input"
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="例: マネージャー向けに、実践例を多めに"
              disabled={loading}
            />
          </label>
          <button className="btn btn--primary" onClick={onGenerate} disabled={loading}>
            {loading ? '生成中…' : '要約台本を生成'}
          </button>

          {loading && (
            <div className="livegen">
              <div className="livegen__head">
                <span className="livegen__dot" /> 台本を生成しています — そのまま読めます
              </div>
              <div className="livegen__body" ref={liveRef} data-testid="live-gen">
                {liveText || '…'}
              </div>
            </div>
          )}

          {!loading && (
            <p className="hint">
              ビジネス書を15〜20分で聴ける要約台本にし、あわせて復習クイズも自動生成します。
            </p>
          )}
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
              disabled={loading}
            />
          </label>

          <div className="field">
            <span className="field__label">要約台本ファイル（.md / .txt / .pdf）</span>
            <label className={`filepick${loading || extracting ? ' is-disabled' : ''}`}>
              <input
                type="file"
                accept=".md,.markdown,.txt,.pdf,text/markdown,text/plain,application/pdf"
                className="filepick__input"
                disabled={loading || extracting !== null}
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <span className="filepick__icon">📄</span>
              <span className="filepick__text">
                {extracting ?? fileName ?? 'タップして .md / .pdf ファイルを選択'}
              </span>
            </label>
          </div>

          {scriptText && (
            <div className="filepreview" data-testid="file-preview">
              <div className="filepreview__head">プレビュー（先頭）</div>
              <div className="filepreview__body">{scriptText.slice(0, 400)}</div>
            </div>
          )}

          <button className="btn btn--primary" onClick={onImport} disabled={loading || !scriptText}>
            {loading ? '取り込み中（復習クイズを生成しています）…' : '取り込む'}
          </button>
          <p className="hint">
            Markdownの見出し（#）や箇条書き・強調記号は読み上げ用に自動で整えます。
            PDFは端末内でテキストを抽出し、スキャンPDF（縦書きの書籍含む）は
            自動で文字認識（OCR）に切り替わります。
          </p>
        </div>
      )}
    </div>
  );
}
