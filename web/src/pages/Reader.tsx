import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLibraryStore } from '../store/libraryStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { PlayerBar } from '../components/PlayerBar';
import { buildObsidianExport, openUri } from '../services/obsidianExport';
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
  const obsidianVault = useSettingsStore((s) => s.obsidianVault);
  const [showRecapCta, setShowRecapCta] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const allSaved = player.savedCount >= player.chunkTotal && player.chunkTotal > 0;
  const busy = player.saveProgress !== null;

  const onSaveAll = async () => {
    setMenuOpen(false);
    setSaveError(null);
    try {
      await player.saveAll();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  // Assemble the narration into one MP3 and hand it to the browser as a
  // download (object URL + anchor click works in mobile Safari/Chrome).
  const onDownloadMp3 = async () => {
    setMenuOpen(false);
    setSaveError(null);
    try {
      const blob = await player.exportMp3();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  // Create/refresh this book's note in Obsidian (recap + quiz + summary).
  // Long notes travel via the clipboard (obsidian://new&clipboard=true).
  const onObsidian = async () => {
    setMenuOpen(false);
    setSaveError(null);
    try {
      const exp = buildObsidianExport(book, obsidianVault || undefined);
      if (exp.viaClipboard) await navigator.clipboard.writeText(exp.content);
      openUri(exp.uri);
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
          className="appbar__action appbar__action--menu"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="オプションメニュー"
          aria-expanded={menuOpen}
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="menu" role="menu">
              <button
                className="menu__item"
                role="menuitem"
                onClick={() => navigate(`/recap/${book.id}`)}
              >
                ✍️ ふりかえりを書く
              </button>
              <button
                className="menu__item"
                role="menuitem"
                onClick={onSaveAll}
                disabled={busy || allSaved}
              >
                💾 {allSaved ? '音声保存済み ✓' : '音声を保存（オフライン再生用）'}
              </button>
              <button
                className="menu__item"
                role="menuitem"
                onClick={onDownloadMp3}
                disabled={busy}
              >
                ⬇️ 音声データをダウンロード（MP3）
              </button>
              <button className="menu__item" role="menuitem" onClick={onObsidian}>
                💎 Obsidianにノート作成
              </button>
            </div>
          </>
        )}
      </header>

      {busy && (
        <div className="banner">
          🔊 音声を準備中 {player.saveProgress!.done}/{player.saveProgress!.total}…
        </div>
      )}

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
        chunkTotal={player.chunkTotal}
        onToggle={player.toggle}
        onSkipForward={player.skipForward}
        onSkipBack={player.skipBack}
        onGenerateCurrent={player.generateCurrent}
      />
    </div>
  );
}
