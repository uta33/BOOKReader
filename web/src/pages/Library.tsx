import { Link, useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../store/libraryStore';
import { useReviewStore } from '../store/reviewStore';

export function Library() {
  const books = useLibraryStore((s) => s.books);
  const removeBook = useLibraryStore((s) => s.removeBook);
  const removeReviews = useReviewStore((s) => s.removeForBook);
  const dueCount = useReviewStore((s) => s.dueCount());
  const navigate = useNavigate();

  const confirmDelete = (id: string, title: string) => {
    if (confirm(`「${title}」を削除しますか？音声キャッシュも削除されます。`)) {
      removeBook(id);
      removeReviews(id);
    }
  };

  return (
    <div className="page">
      <header className="appbar">
        <h1 className="appbar__title">BOOKReader</h1>
      </header>

      {dueCount > 0 && (
        <Link to="/review" className="banner">
          🔁 今日の復習が {dueCount} 件あります
        </Link>
      )}

      {books.length === 0 ? (
        <div className="empty">
          <p className="empty__title">まだ本がありません</p>
          <p className="empty__sub">
            AIに要約台本を生成してもらうか、手元の要約を貼り付けて始めましょう。
          </p>
          <Link to="/add" className="btn btn--primary">
            ＋ コンテンツを追加
          </Link>
        </div>
      ) : (
        <ul className="cardlist">
          {books.map((b) => {
            const pct = b.sentences.length
              ? Math.round(((b.lastSentenceIdx + 1) / b.sentences.length) * 100)
              : 0;
            return (
              <li key={b.id} className="card">
                <button
                  className="card__main"
                  onClick={() => navigate(`/reader/${b.id}`)}
                >
                  <div className="card__title">{b.title}</div>
                  <div className="card__meta">
                    <span>{b.source === 'ai' ? '🤖 AI生成' : '📝 取り込み'}</span>
                    <span>{b.sentences.length} 文</span>
                    <span>{pct}% 読了</span>
                    {b.recap && <span>✅ ふりかえり済</span>}
                  </div>
                  <div className="progress">
                    <div className="progress__bar" style={{ width: `${pct}%` }} />
                  </div>
                </button>
                <button
                  className="card__delete"
                  onClick={() => confirmDelete(b.id, b.title)}
                  aria-label="削除"
                >
                  🗑
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Link to="/add" className="fab" aria-label="追加">
        ＋
      </Link>
    </div>
  );
}
