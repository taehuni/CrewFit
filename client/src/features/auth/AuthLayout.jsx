import { Link } from 'react-router';
import { Wordmark } from '../../shared/AppShell.jsx';
import AuthBackdrop from './AuthBackdrop.jsx';
import './auth.css';

// 인증 화면 공통 틀. 데스크톱은 브랜드 장면 + 폼, 모바일은 브랜드 장면을 압축한다.
export default function AuthLayout({ title, tagline, heading, description, children, footer }) {
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <AuthBackdrop />
        <Link to="/" className="auth-brand" aria-label="CrewFit 소개로 돌아가기"><Wordmark /></Link>
        <div className="auth-story-copy">
          <p className="auth-story-title">{title}</p>
          {tagline && <p className="auth-story-description">{tagline}</p>}
        </div>
      </aside>

      <main className="auth-pane">
        <div className="auth-box">
          <header className="auth-heading">
            <h1>{heading}</h1>
            {description && <p className="auth-description">{description}</p>}
          </header>
          {children}
          {footer && <footer className="auth-foot">{footer}</footer>}
          <Link to="/" className="auth-home-link">서비스 소개로 돌아가기</Link>
        </div>
      </main>
    </div>
  );
}

export { authMessage } from './authMessage.js';
