import { useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '../../shared/supabaseClient.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import AuthLayout, { authMessage } from './AuthLayout.jsx';

// 재설정 메일 요청. 링크는 /reset-password로 돌아옴 (Supabase 대시보드 Redirect URLs에 등록 필요).
export default function ForgotPasswordPage() {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email');
    setBusy(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return setError(authMessage(error));
    setSent(true);
  }

  return (
    <AuthLayout tagline="가입한 이메일로 재설정 링크를 보내 드려요." footer={<Link to="/login">로그인으로 돌아가기</Link>}>
      {sent ? (
        <FormMessage tone="ok">메일을 보냈어요. 받은 편지함에서 링크를 열어 새 비밀번호를 정해 주세요.</FormMessage>
      ) : (
        <form className="form" onSubmit={onSubmit}>
          <Field id="email" name="email" type="email" label="이메일" autoComplete="email" inputMode="email" spellCheck={false} placeholder="name@example.com" required />
          <FormMessage>{error}</FormMessage>
          <Button type="submit" block disabled={busy}>{busy ? '보내는 중…' : '재설정 메일 보내기'}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
