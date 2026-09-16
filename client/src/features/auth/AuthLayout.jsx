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

// supabase-js 에러(영문) → 사용자 문장. 못 알아보면 원문.
export function authMessage(error) {
  const m = error?.message || '';
  if (/invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요. 다시 확인해 주세요.';
  if (/already registered|already been registered/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (/password should be at least/i.test(m)) return '비밀번호는 6자 이상이어야 해요.';
  if (/rate limit|too many requests/i.test(m)) return '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.';
  if (/session|expired|invalid.*token/i.test(m)) return '링크가 만료됐어요. 비밀번호 재설정 메일을 다시 요청해 주세요.';
  return m || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
}
