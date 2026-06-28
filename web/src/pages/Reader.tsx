import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLibraryStore } from '../store/libraryStore';
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

export function Reader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const book = useLibraryStore((s) => s.books.find((b) => b.id === id));
  const [showRecapCta, setShowRecapCta] = useState(false);

  const player = useAudioPlayer(book ?? EMPTY_BOOK, () => setShowRecapCta(true));

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

  return (
    <div className="page page--reader">
      <header className="appbar appbar--back">
        <button className="appbar__back" onClick={() => navigate('/')} aria-label="戻る">
          ‹
        </button>
        <h1 className="appbar__title appbar__title--ellipsis">{book.title}</h1>
        <button className="appbar__action" onClick={() => navigate(`/recap/${book.id}`)}>
          ふりかえり
        </button>
      </header>

      {showRecapCta && (
        <button className="banner banner--accent" onClick={() => navigate(`/recap/${book.id}`)}>
          🎉 最後まで読みました。自分の言葉でふりかえって定着させましょう →
        </button>
      )}

      <ul className="reader">
        {book.sentences.map((s, i) => (
          <li
            key={s.id}
            ref={i === player.currentIdx ? activeRef : null}
            className={`reader__sentence${i === player.currentIdx ? ' is-active' : ''}${
              i < player.currentIdx ? ' is-read' : ''
            }`}
            onClick={() => player.jumpTo(i)}
          >
            {s.text}
          </li>
        ))}
      </ul>

      <PlayerBar
        isPlaying={player.isPlaying}
        mode={player.mode}
        prefetched={player.prefetched}
        total={player.total}
        currentIdx={player.currentIdx}
        onToggle={player.toggle}
        onSkipForward={player.skipForward}
        onSkipBack={player.skipBack}
      />
    </div>
  );
}
