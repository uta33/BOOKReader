import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLibraryStore } from '../store/libraryStore';
import { useReviewStore } from '../store/reviewStore';
import { useStatsStore } from '../store/statsStore';

export function Recap() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const book = useLibraryStore((s) => s.books.find((b) => b.id === id));
  const updateBook = useLibraryStore((s) => s.updateBook);
  const addFromRecap = useReviewStore((s) => s.addFromRecap);
  const addRecap = useStatsStore((s) => s.addRecap);

  const [summary, setSummary] = useState(book?.recap ?? '');
  const [saved, setSaved] = useState(false);

  if (!book) {
    return (
      <div className="page">
        <header className="appbar appbar--back">
          <button className="appbar__back" onClick={() => navigate('/')} aria-label="戻る">
            ‹
          </button>
          <h1 className="appbar__title">本が見つかりません</h1>
        </header>
      </div>
    );
  }

  const onSave = () => {
    if (!summary.trim()) return;
    updateBook(book.id, { recap: summary.trim(), recapCreatedAt: Date.now() });
    addFromRecap(book.id, book.title, summary.trim(), book.quiz);
    if (!saved) addRecap();
    setSaved(true);
  };

  return (
    <div className="page">
      <header className="appbar appbar--back">
        <button className="appbar__back" onClick={() => navigate(`/reader/${book.id}`)} aria-label="戻る">
          ‹
        </button>
        <h1 className="appbar__title appbar__title--ellipsis">ふりかえり</h1>
      </header>

      <div className="form">
        <p className="lead">
          聴いたことを<strong>見ずに</strong>、自分の言葉で書き出すと記憶に定着します（生成効果）。
        </p>

        <label className="field">
          <span className="field__label">
            「{book.title}」で一番大事だと思ったことと、明日どう使うか
          </span>
          <textarea
            className="input textarea"
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              setSaved(false);
            }}
            rows={10}
            placeholder="例: 重要だが緊急でないことに時間を投資する。明日は朝の30分を顧客分析にあてる。"
          />
        </label>

        <button className="btn btn--primary" onClick={onSave} disabled={!summary.trim()}>
          保存して復習に登録
        </button>

        {saved && (
          <div className="alert alert--success">
            ✅ 保存しました。明日から「復習」に出題されます
            {book.quiz && book.quiz.length > 0
              ? `（あなたのふりかえり＋クイズ${book.quiz.length}問）。`
              : '。'}
            <div className="alert__actions">
              <button className="btn btn--ghost" onClick={() => navigate('/review')}>
                復習へ
              </button>
              <button className="btn btn--ghost" onClick={() => navigate('/')}>
                ホームへ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
