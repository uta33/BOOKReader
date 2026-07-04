import { Routes, Route, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { BottomNav } from './components/BottomNav';
import { Library } from './pages/Library';
import { AddContent } from './pages/AddContent';
import { Reader } from './pages/Reader';
import { Recap } from './pages/Recap';
import { Review } from './pages/Review';
import { Settings } from './pages/Settings';

const HIDE_NAV_PREFIXES = ['/reader/', '/recap/'];

export default function App() {
  const { pathname } = useLocation();
  const hideNav = HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <div className={`app${hideNav ? '' : ' app--with-nav'}`}>
      <main className="app__main">
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/add" element={<AddContent />} />
          <Route path="/reader/:id" element={<Reader />} />
          <Route path="/recap/:id" element={<Recap />} />
          <Route path="/review" element={<Review />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
      <Analytics />
    </div>
  );
}
