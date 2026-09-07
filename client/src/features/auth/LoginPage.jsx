import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { supabase } from '../../shared/supabaseClient.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import AuthLayout, { authMessage } from './AuthLayout.jsx';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const from = useLocation().state?.from || '/';

  async function onSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    setBusy(false);
    if (error) return setError(authMessage(error));
    navigate(from, { replace: true });
  }

  return (
    <AuthLayout
      tagline="기록하고, 크루와 같이 뛰자."
      footer={<><Link to="/signup">처음이면 가입하기</Link><Link to="/forgot">비밀번호를 잊었어요</Link></>}
    >
      <form className="form" onSubmit={onSubmit} noValidate={false}>
        <Field id="email" name="email" type="email" label="이메일" autoComplete="email" inputMode="email" spellCheck={false} placeholder="name@example.com" required />
        <Field id="password" name="password" type="password" label="비밀번호" autoComplete="current-password" required />
        <FormMessage>{error}</FormMessage>
        <Button type="submit" block disabled={busy}>{busy ? '로그인 중…' : '로그인'}</Button>
      </form>
    </AuthLayout>
  );
}
