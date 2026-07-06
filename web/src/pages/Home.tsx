import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../store/libraryStore';
import { useReviewStore } from '../store/reviewStore';
import { useStatsStore } from '../store/statsStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  DAILY_LISTEN_GOAL_MS,
  EMPTY_DAY,
  computeStreak,
  dayKey,
  totals,
} from '../services/stats';
import { ActivityCalendar } from '../components/ActivityCalendar';
import type { Book } from '../types/book';

/** Rough Japanese TTS pace used for the "about N min left" estimate. */
const CHARS_PER_SEC = 6.5;

function isFinished(b: Book): boolean {
  return b.sentences.length > 0 && b.lastSentenceIdx >= b.sentences.length - 1;
}

function remainingMin(b: Book, rate: number): number {
  const chars = b.sentences
    .slice(b.lastSentenceIdx)
    .reduce((sum, s) => sum + s.text.length, 0);
  return Math.max(1, Math.ceil(chars / CHARS_PER_SEC / rate / 60));
}

export function Home() {
  const books = useLibraryStore((s) => s.books);
  const dueCount = useReviewStore((s) => s.dueCount());
  const days = useStatsStore((s) => s.days);
  const speakingRate = useSettingsStore((s) => s.speakingRate);
  const navigate = useNavigate();

  const today = days[dayKey()] ?? EMPTY_DAY;
  const streak = computeStreak(days);
  const lifetime = useMemo(() => totals(days), [days]);
  const finishedCount = books.filter(isFinished).length;

  // The book to continue: most recently opened, not yet finished.
  const continueBook = useMemo(() => {
    return [...books]
      .filter((b) => !isFinished(b))
      .sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt))[0];
  }, [books]);

  // A finished book still waiting for its recap (elaboration step).
  const pendingRecapBook = useMemo(
    () => books.find((b) => isFinished(b) && !b.recap),
    [books],
  );

  const listenPct = Math.min(100, Math.round((today.listenMs / DAILY_LISTEN_GOAL_MS) * 100));
  const listenDone = today.listenMs >= DAILY_LISTEN_GOAL_MS;
  const reviewDone = dueCount === 0 && today.reviews > 0;
  const noReviewToday = dueCount === 0 && today.reviews === 0;
  const recapDone = today.recaps > 0;
  const showRecapRow = Boolean(pendingRecapBook) || recapDone;

  const allDone =
    listenDone && dueCount === 0 && (!showRecapRow || recapDone || !pendingRecapBook);

  const streakLabel =
    streak === 0
      ? '今日から始めよう'
      : `${streak}日連続${today.listenMs || today.reviews || today.recaps ? '' : '（今日も続けよう）'}`;

  if (books.length === 0) {
    return (
      <div className="page">
        <header className="appbar">
          <h1 className="appbar__title">BOOKReader</h1>
        </header>
        <div className="empty">
          <p className="empty__title">まだ本がありません</p>
          <p className="empty__sub">
            AIに要約台本を生成してもらうか、手元の要約を取り込んで始めましょう。
            1日15分の習慣が、ここから積み上がっていきます。
          </p>
          <Link to="/add" className="btn btn--primary">
            ＋ 最初の本を追加
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="appbar">
        <h1 className="appbar__title">ホーム</h1>
        <span className="streak" title="連続学習日数">
          🔥 {streakLabel}
        </span>
      </header>

      {allDone && <div className="banner banner--accent">🎉 今日のミッション完了！おつかれさまでした</div>}

      <section className="home__section">
        <h2 className="home__heading">今日のやること</h2>
        <ul className="checklist">
          <li>
            <button
              className={`checklist__row${reviewDone ? ' is-done' : noReviewToday ? ' is-muted' : ''}`}
              onClick={() => navigate('/review')}
            >
              <span className="checklist__mark">{reviewDone ? '✓' : '🔁'}</span>
              <span className="checklist__body">
                <span className="checklist__label">復習する</span>
                <span className="checklist__sub">
                  {dueCount > 0
                    ? `今日の出題 ${dueCount}件`
                    : reviewDone
                      ? `完了（${today.reviews}件）`
                      : '今日の出題はありません'}
                </span>
              </span>
              {dueCount > 0 && <span className="badge badge--inline">{dueCount}</span>}
            </button>
          </li>
          <li>
            <button
              className={`checklist__row${listenDone ? ' is-done' : ''}`}
              onClick={() => navigate(continueBook ? `/reader/${continueBook.id}` : '/add')}
            >
              <span className="checklist__mark">{listenDone ? '✓' : '🎧'}</span>
              <span className="checklist__body">
                <span className="checklist__label">続きを聴く（目標15分）</span>
                <span className="checklist__sub">
                  今日 {Math.round(today.listenMs / 60000)}分 / 15分
                </span>
                <span className="progress progress--thin">
                  <span className="progress__bar" style={{ width: `${listenPct}%` }} />
                </span>
              </span>
            </button>
          </li>
          {showRecapRow && (
            <li>
              <button
                className={`checklist__row${recapDone ? ' is-done' : ''}`}
                onClick={() =>
                  pendingRecapBook && navigate(`/recap/${pendingRecapBook.id}`)
                }
              >
                <span className="checklist__mark">{recapDone ? '✓' : '✍️'}</span>
                <span className="checklist__body">
                  <span className="checklist__label">ふりかえりを書く</span>
                  <span className="checklist__sub">
                    {pendingRecapBook
                      ? `「${pendingRecapBook.title}」を自分の言葉で`
                      : '今日のふりかえり済み'}
                  </span>
                </span>
              </button>
            </li>
          )}
        </ul>
      </section>

      {continueBook && (
        <section className="home__section">
          <button className="hero" onClick={() => navigate(`/reader/${continueBook.id}`)}>
            <span className="hero__eyebrow">続きから聴く</span>
            <span className="hero__title">{continueBook.title}</span>
            <span className="progress">
              <span
                className="progress__bar"
                style={{
                  width: `${Math.round(((continueBook.lastSentenceIdx + 1) / continueBook.sentences.length) * 100)}%`,
                }}
              />
            </span>
            <span className="hero__meta">
              あと約{remainingMin(continueBook, speakingRate)}分で読了 ・ タップで再開 ▶
            </span>
          </button>
        </section>
      )}

      <section className="home__section">
        <h2 className="home__heading">学習カレンダー</h2>
        <ActivityCalendar days={days} />
        <p className="home__totals">
          累計 {lifetime.listenMin}分 ・ 完読 {finishedCount}冊 ・ 復習 {lifetime.reviews}回 ・
          学習日 {lifetime.activeDays}日
        </p>
      </section>
    </div>
  );
}
