import { NavLink } from 'react-router-dom';
import { useReviewStore } from '../store/reviewStore';

const items = [
  { to: '/', label: 'ライブラリ', icon: '📚', end: true },
  { to: '/add', label: '追加', icon: '＋' },
  { to: '/review', label: '復習', icon: '🔁' },
  { to: '/settings', label: '設定', icon: '⚙️' },
];

export function BottomNav() {
  const dueCount = useReviewStore((s) => s.dueCount());
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) => `bottom-nav__item${isActive ? ' is-active' : ''}`}
        >
          <span className="bottom-nav__icon">
            {it.icon}
            {it.to === '/review' && dueCount > 0 && (
              <span className="badge">{dueCount}</span>
            )}
          </span>
          <span className="bottom-nav__label">{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
