import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { supabase } from '../../shared/supabaseClient.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import AuthLayout, { authMessage } from './AuthLayout.jsx';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const navigate = useNavigate();
  const from = useLocation().state?.from || '/home';

  async function onSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(''); setUnconfirmedEmail('');
    const { error } = await supabase.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    setBusy(false);
    if (error) {
      if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) setUnconfirmedEmail(f.get('email').trim());
      return setError(authMessage(error));
    }
    navigate(from, { replace: true });
  }

  return (
    <AuthLayout
      title={<>다시 운동할<br />시간이에요.</>}
      heading="로그인"
      description="가입한 이메일로 로그인해 기록을 이어가세요."
    >
      <form className="form" onSubmit={onSubmit}>
        <Field id="email" name="email" type="email" label="이메일" autoComplete="email" inputMode="email" spellCheck={false} placeholder="name@example.com" required />
        <Field id="password" name="password" type="password" label="비밀번호" labelAction={<Link to="/forgot">비밀번호 찾기</Link>} autoComplete="current-password" required />
        <FormMessage>{error}</FormMessage>
        {unconfirmedEmail && <Link to="/verify-email" state={{ email: unconfirmedEmail }}>인증 메일 다시 받기</Link>}
        <Button type="submit" block disabled={busy}>{busy ? '로그인 중…' : '로그인'}</Button>
      </form>
      <Link to="/signup" className="btn btn-ghost btn-block auth-secondary">무료로 시작하기</Link>
    </AuthLayout>
  );
}
