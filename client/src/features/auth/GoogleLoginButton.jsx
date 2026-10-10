import { useRef, useState } from 'react';
import { supabase } from '../../shared/supabaseClient.js';
import { startGoogleLogin } from './googleAuth.js';

export default function GoogleLoginButton({ disabled = false, next = '/home' }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signIn() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error();
      const settings = await response.json();
      if (!settings.external?.google) {
        setError('구글 로그인 연결을 준비 중이에요. 지금은 이메일로 이용해 주세요.');
        return;
      }
      await startGoogleLogin(supabase.auth, { origin: window.location.origin, next });
    } catch { setError('구글 로그인에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="google-login"><button type="button" className="btn btn-block google-login-button" disabled={busy || disabled} onClick={signIn}>
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.59-4.1H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.94a6 6 0 0 1 0-3.88V7.47H3.07a10 10 0 0 0 0 9.06l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.47l3.34 2.59C7.2 7.71 9.4 5.96 12 5.96Z"/></svg>
    {busy ? '구글로 연결 중…' : 'Google로 계속하기'}
  </button>{error && <p role="alert" className="google-login-error">{error}</p>}<div className="auth-divider"><span>또는 이메일로</span></div></div>;
}
