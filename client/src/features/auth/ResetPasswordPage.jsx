import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../../shared/supabaseClient.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import AuthLayout, { authMessage } from './AuthLayout.jsx';
import { useAuth } from './AuthContext.jsx';

// 메일 링크 착지. supabase-js가 URL의 recovery 토큰으로 세션을 만들어 주므로(detectSessionInUrl)
// 세션이 생기면 새 비밀번호만 받으면 됨. 세션이 없으면 링크 만료.
export default function ResetPasswordPage() {
  const { loading, session } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) return setError('두 비밀번호가 서로 달라요.');
    setBusy(true); setError('');
    const { error } = await supabase.auth.updateUser({ password: f.get('password') });
    setBusy(false);
    if (error) return setError(authMessage(error));
    navigate('/home', { replace: true });
  }

  if (loading) return <div className="center">링크 확인 중…</div>;

  return (
    <AuthLayout
      title={<>새 비밀번호로,<br />기록을 이어가세요.</>}
      tagline="계정만 다시 확인하면 기존 운동 기록은 그대로 이어집니다."
      heading="새 비밀번호 설정"
      description="앞으로 사용할 비밀번호를 입력하세요."
      footer={<p><Link to="/forgot">재설정 메일 다시 받기</Link></p>}
    >
      {!session ? (
        <FormMessage>링크가 만료됐거나 잘못됐어요. 재설정 메일을 다시 요청해 주세요.</FormMessage>
      ) : (
        <form className="form" onSubmit={onSubmit}>
          <Field id="password" name="password" type="password" label="새 비밀번호" autoComplete="new-password" minLength={6} required hint="6자 이상" />
          <Field id="confirm" name="confirm" type="password" label="새 비밀번호 확인" autoComplete="new-password" minLength={6} required />
          <FormMessage>{error}</FormMessage>
          <Button type="submit" block disabled={busy}>{busy ? '바꾸는 중…' : '비밀번호 바꾸기'}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
