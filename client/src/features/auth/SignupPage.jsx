import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../../shared/supabaseClient.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import AuthLayout, { authMessage } from './AuthLayout.jsx';

// 닉네임은 options.data.nickname → DB 가입 트리거가 profiles에 넣음 (api.md 2절). 확인 메일 OFF라 즉시 세션.
export default function SignupPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nickname = f.get('nickname').trim();
    setBusy(true); setError('');
    const { data, error } = await supabase.auth.signUp({
      email: f.get('email'),
      password: f.get('password'),
      options: { data: { nickname } },
    });
    setBusy(false);
    if (error) return setError(authMessage(error));
    if (!data.session) return setError('가입은 됐지만 로그인 세션이 없어요. 로그인 화면에서 다시 시도해 주세요.');
    navigate('/', { replace: true });
  }

  return (
    <AuthLayout tagline="가입하면 바로 기록을 시작할 수 있어요." footer={<Link to="/login">이미 계정이 있으면 로그인</Link>}>
      <form className="form" onSubmit={onSubmit}>
        <Field id="nickname" name="nickname" type="text" label="닉네임" autoComplete="nickname" spellCheck={false} placeholder="크루에 보일 이름…" minLength={2} maxLength={20} required hint="2~20자. 나중에 바꿀 수 있어요." />
        <Field id="email" name="email" type="email" label="이메일" autoComplete="email" inputMode="email" spellCheck={false} placeholder="name@example.com" required />
        <Field id="password" name="password" type="password" label="비밀번호" autoComplete="new-password" minLength={6} required hint="6자 이상" />
        <FormMessage>{error}</FormMessage>
        <Button type="submit" block disabled={busy}>{busy ? '가입 중…' : '가입하고 시작하기'}</Button>
      </form>
    </AuthLayout>
  );
}
