import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReviewStore } from '../store/reviewStore';
import { useLibraryStore } from '../store/libraryStore';
import { REVIEW_INTERVALS_MS } from '../services/spacedRepetition';
import type { RecallGrade } from '../types/book';

const STAGE_LABEL = ['1日後', '3日後', '1週間後', '2週間後', '1ヶ月後'];

export function Review() {
  const items = useReviewStore((s) => s.items);
  const grade = useReviewStore((s) => s.grade);
  const books = useLibraryStore((s) => s.books);

  // Snapshot the due queue once on mount so grading doesn't reshuffle mid-session.
  const queue = useMemo(() => items.filter((i) => i.dueAt <= Date.now()).map((i) => i.id), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const currentId = queue[pos];
  const current = items.find((i) => i.id === currentId);
  const done = pos >= queue.length;
  const bookTitle = current ? books.find((b) => b.id === current.bookId)?.title : undefined;

  const onGrade = (g: RecallGrade) => {
    if (!current) return;
    grade(current.id, g);
    setRevealed(false);
    setPos((p) => p + 1);
  };

  return (
    <div className="page">
      <header className="appbar">
        <h1 className="appbar__title">復習</h1>
      </header>

      {queue.length === 0 ? (
        <div className="empty">
          <p className="empty__title">今日の復習はありません</p>
          <p className="empty__sub">
            本を読み終えたら「ふりかえり」を書くと、あなたの要約とクイズが間隔をあけて出題されます。
          </p>
          <Link to="/" className="btn btn--primary">
            ライブラリへ
          </Link>
        </div>
      ) : done ? (
        <div className="empty">
          <p className="empty__title">🎉 今日の復習を完了しました</p>
          <p className="empty__sub">{queue.length} 件を復習しました。また間隔をあけて出題されます。</p>
          <Link to="/" className="btn btn--primary">
            ライブラリへ
          </Link>
        </div>
      ) : current ? (
        <div className="review">
          <div className="review__progress">
            {pos + 1} / {queue.length}（{STAGE_LABEL[current.stage] ?? ''}の復習）
          </div>

          <div className="review__card">
            <div className="review__source">
              <span className={`pill${current.kind === 'quiz' ? ' pill--quiz' : ''}`}>
                {current.kind === 'quiz' ? 'クイズ' : 'ふりかえり'}
              </span>
              {bookTitle && <span className="review__book">{bookTitle}</span>}
            </div>

            <div className="review__prompt">{current.prompt}</div>

            {!revealed ? (
              <button className="btn btn--primary" onClick={() => setRevealed(true)}>
                思い出した — 答えを表示
              </button>
            ) : (
              <>
                <div className="review__answer">{current.answer}</div>
                <p className="review__ask">どれくらい思い出せましたか？</p>
                <div className="review__grades">
                  <button className="btn btn--danger" onClick={() => onGrade('forgot')}>
                    忘れていた
                  </button>
                  <button className="btn btn--ghost" onClick={() => onGrade('unsure')}>
                    あいまい
                  </button>
                  <button className="btn btn--success" onClick={() => onGrade('recalled')}>
                    思い出せた
                  </button>
                </div>
                <p className="hint">
                  「思い出せた」で次回は{' '}
                  {STAGE_LABEL[Math.min(current.stage + 1, REVIEW_INTERVALS_MS.length - 1)]}{' '}
                  に出題されます。
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
