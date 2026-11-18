import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '../../shared/supabaseClient.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import AuthLayout, { authMessage } from './AuthLayout.jsx';
import { Capacitor } from '@capacitor/core';
import { sendNativeAuthEmail } from './nativeAuthRuntime.js';

// 재설정 메일 요청. 링크는 /reset-password로 돌아옴 (Supabase 대시보드 Redirect URLs에 등록 필요).
export default function ForgotPasswordPage() {
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).get('nativeAuth') === 'failed' ? '링크를 확인하지 못했어요. 이 기기에서 새 메일을 요청하고 가장 최근 링크를 열어 주세요.' : '');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    const email = new FormData(e.currentTarget).get('email');
    setBusy(true); setError('');
    try {
      const send = async (redirectTo = `${window.location.origin}/reset-password`) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
      };
      await (Capacitor.isNativePlatform() ? sendNativeAuthEmail('recovery', send) : send());
      setSent(true);
    } catch (error) { setError(authMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }

  return (
    <AuthLayout
      title={<>멈춘 기록도,<br />다시 이어갈 수 있어요.</>}
      tagline="가입한 이메일로 안전하게 재설정 링크를 보내 드립니다."
      heading="비밀번호 재설정"
      description="가입할 때 사용한 이메일을 입력하세요."
      footer={<p><Link to="/login">로그인으로 돌아가기</Link></p>}
    >
      {sent ? (
        <FormMessage tone="ok">메일을 보냈어요. 받은 편지함에서 가장 최근 링크를 열어 새 비밀번호를 정해 주세요.{Capacitor.isNativePlatform() && ' 메일은 지금 사용 중인 휴대폰에서 열고 CrewFit으로 돌아와 주세요.'}</FormMessage>
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
