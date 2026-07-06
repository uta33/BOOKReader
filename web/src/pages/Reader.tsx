import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLibraryStore } from '../store/libraryStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { PlayerBar } from '../components/PlayerBar';
import type { Book } from '../types/book';

const EMPTY_BOOK: Book = {
  id: '',
  title: '',
  source: 'script',
  sentences: [],
  lastSentenceIdx: 0,
  createdAt: 0,
};

interface Chapter {
  label: string;
  startIdx: number;
  section: number;
}

export function Reader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const book = useLibraryStore((s) => s.books.find((b) => b.id === id));
  const updateBook = useLibraryStore((s) => s.updateBook);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const [showRecapCta, setShowRecapCta] = useState(false);

  // Remember which book was opened last so Home's "continue" card picks it.
  useEffect(() => {
    if (id) updateBook(id, { lastOpenedAt: Date.now() });
  }, [id, updateBook]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const player = useAudioPlayer(book ?? EMPTY_BOOK, () => setShowRecapCta(true));

  // Chapter list derived from heading sentences (fallback: whole book).
  const chapters = useMemo<Chapter[]>(() => {
    if (!book) return [];
    const list: Chapter[] = [];
    book.sentences.forEach((s, i) => {
      if (s.isHeading && !list.some((c) => c.section === s.section)) {
        list.push({ label: s.text.replace(/。$/, ''), startIdx: i, section: s.section });
      }
    });
    return list;
  }, [book]);

  const currentSection = book?.sentences[player.currentIdx]?.section ?? 1;

  const activeRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [player.currentIdx]);

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

  const allSaved = player.savedCount >= player.total && player.total > 0;

  const onSaveAll = async () => {
    setSaveError(null);
    try {
      await player.saveAll();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="page page--reader">
      <header className="appbar appbar--back">
        <button className="appbar__back" onClick={() => navigate('/')} aria-label="戻る">
          ‹
        </button>
        <h1 className="appbar__title appbar__title--ellipsis">{book.title}</h1>
        <button
          className="appbar__action"
          onClick={onSaveAll}
          disabled={player.saveProgress !== null || allSaved}
          title="全文の音声を端末に保存（オフライン再生用）"
        >
          {player.saveProgress
            ? `保存中 ${player.saveProgress.done}/${player.saveProgress.total}`
            : allSaved
              ? '音声保存済み✓'
              : '音声を保存'}
        </button>
        <button className="appbar__action" onClick={() => navigate(`/recap/${book.id}`)}>
          ふりかえり
        </button>
      </header>

      {chapters.length > 0 && (
        <div className="chapters">
          {chapters.map((c) => (
            <button
              key={c.section}
              className={`chapter-chip${c.section === currentSection ? ' is-active' : ''}`}
              onClick={() => player.jumpTo(c.startIdx)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {saveError && <div className="alert alert--error">{saveError}</div>}

      {showRecapCta && (
        <button className="banner banner--accent" onClick={() => navigate(`/recap/${book.id}`)}>
          🎉 最後まで読みました。自分の言葉でふりかえって定着させましょう →
        </button>
      )}

      <ul className={`reader reader--${fontScale}`}>
        {book.sentences.map((s, i) => (
          <li
            key={s.id}
            ref={i === player.currentIdx ? activeRef : null}
            className={
              s.isHeading
                ? `reader__heading${i === player.currentIdx ? ' is-active' : ''}`
                : `reader__sentence${i === player.currentIdx ? ' is-active' : ''}${
                    i < player.currentIdx ? ' is-read' : ''
                  }`
            }
            onClick={() => player.jumpTo(i)}
          >
            {s.text}
          </li>
        ))}
      </ul>

      <PlayerBar
        isPlaying={player.isPlaying}
        mode={player.mode}
        total={player.total}
        currentIdx={player.currentIdx}
        savedCount={player.savedCount}
        onToggle={player.toggle}
        onSkipForward={player.skipForward}
        onSkipBack={player.skipBack}
        onGenerateCurrent={player.generateCurrent}
      />
    </div>
  );
}
