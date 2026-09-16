import { Link, NavLink, Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../features/auth/index.js';
import { api } from './api.js';
import { queryKeys } from './queryKeys.js';
import { bibNumber } from './ui.jsx';
import './workspace.css';

const TABS = [
  { to: '/home', label: '홈', d: 'M3 11.5 12 4l9 7.5M5 10v10h14V10' },
  { to: '/activities', label: '기록', d: 'M4 17h3l3-9 4 12 3-7h3' },
  { to: '/crews', label: '크루', d: 'M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2-5 5-5s5 2 5 5M13 20c0-3 2-5 5-5s3 1 3 5' },
  { to: '/feed', label: '피드', d: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5' },
  { to: '/me', label: '나', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-4 3-6 7-6s7 2 7 6' },
];

export function Wordmark() {
  return (
    <span className="wordmark" translate="no" aria-label="CrewFit">
      <svg className="brand-mark" viewBox="0 0 240 240" fill="none" aria-hidden="true" focusable="false">
        <use href="/crewfit-mark.svg#crewfit-symbol" />
      </svg>
      <span className="brand-word">CREWFIT</span>
    </span>
  );
}

export default function AppShell() {
  const { user, token } = useAuth();
  const me = useQuery({ queryKey: queryKeys.me(user.id), queryFn: () => api('/me', { token }) });
  return <WorkspaceFrame nickname={me.data?.profile?.nickname} number={bibNumber(user.id)} />;
}

// 하나의 nav를 데스크톱 상단 / 모바일 하단에 배치.
export function WorkspaceFrame({ nickname, number }) {
  return (
    <div className="workspace">
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <header className="ws-header">
        <Link to="/home" className="ws-brand" aria-label="CrewFit 홈"><Wordmark /></Link>
      <nav className="ws-nav" aria-label="주요 메뉴">
        <div className="ws-nav-links">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className="ws-nav-item">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.d} /></svg>
            <span>{t.label}</span>
          </NavLink>
        ))}
        </div>
      </nav>
        <Link to="/me" className="ws-account" aria-label="내 계정 관리">
          {number && <span className="ws-bib" aria-hidden="true">{number}</span>}
          <span className="ws-account-name">{nickname || '내 계정'}</span>
        </Link>
      </header>
      <main id="main" className="ws-main" tabIndex={-1}><Outlet /></main>
    </div>
  );
}
