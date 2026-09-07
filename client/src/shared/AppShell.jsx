import { NavLink, Outlet } from 'react-router';

const TABS = [
  { to: '/', label: '홈', end: true, d: 'M3 11.5 12 4l9 7.5M5 10v10h14V10' },
  { to: '/activities', label: '기록', d: 'M4 17h3l3-9 4 12 3-7h3' },
  { to: '/crews', label: '크루', d: 'M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2-5 5-5s5 2 5 5M13 20c0-3 2-5 5-5s3 1 3 5' },
  { to: '/feed', label: '피드', d: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5' },
  { to: '/me', label: '나', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-4 3-6 7-6s7 2 7 6' },
];

export function Wordmark() {
  return (
    <span className="wordmark" translate="no">
      Crew<em>Fit</em>
    </span>
  );
}

// 모바일: 상단 워드마크 + 하단 탭. 768px+: 왼쪽 레일(워드마크 + 같은 탭). 탭은 하나의 nav로 재사용.
export default function AppShell() {
  return (
    <div className="shell">
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <header className="shell-head">
        <Wordmark />
      </header>
      <main id="main" className="shell-main" tabIndex={-1}>
        <Outlet />
      </main>
      <nav className="shell-nav" aria-label="주요 메뉴">
        <Wordmark />
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="tab">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.d} /></svg>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
