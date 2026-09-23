import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../../shared/supabaseClient.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import AuthLayout, { authMessage } from './AuthLayout.jsx';
import { normalizeMemberName } from '../../shared/memberName.js';
import { signupWithEmail } from './authLinks.js';

// 가입 트리거가 닉네임은 profiles, 실명은 본인 전용 user_settings에 저장한다 (D-28).
export default function SignupPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const submitting = useRef(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting.current) return;
    const f = new FormData(e.currentTarget);
    const nickname = f.get('nickname').trim();
    let real_name;
    try {
      real_name = normalizeMemberName(f.get('real_name'));
    } catch (err) {
      return setError(err.message);
    }
    if (nickname.length < 2) return setError('닉네임은 공백을 제외하고 2자 이상 입력해 주세요.');
    submitting.current = true;
    setBusy(true); setError('');
    const email = f.get('email').trim();
    try {
      const status = await signupWithEmail(supabase.auth, {
        email, password: f.get('password'), nickname, real_name,
      }, window.location.origin);
      navigate(status === 'signed-in' ? '/home' : '/verify-email', {
        replace: true, state: { email, sent: true },
      });
    } catch (err) { setError(authMessage(err)); }
    finally { submitting.current = false; setBusy(false); }
  }

  return (
    <AuthLayout
      title={<>첫 기록부터,<br />내 페이스대로.</>}
      heading="무료로 시작하기"
      description="무료 계정을 만들고 오늘 운동부터 기록하세요."
      footer={<p>이미 계정이 있나요? <Link to="/login">로그인</Link></p>}
    >
      <form className="form" onSubmit={onSubmit}>
        <Field id="nickname" name="nickname" type="text" label="닉네임" autoComplete="nickname" spellCheck={false} placeholder="활동할 때 쓸 닉네임" minLength={2} maxLength={20} required hint="2~20자. 프로필과 글에는 실명 대신 닉네임이 보여요." />
        <Field id="real-name" name="real_name" type="text" label="이름 (실명)" autoComplete="name" spellCheck={false} placeholder="실명을 입력하세요" maxLength={50} required hint="본인과 가입이 승인된 크루의 크루장만 볼 수 있어요." />
        <Field id="email" name="email" type="email" label="이메일" autoComplete="email" inputMode="email" spellCheck={false} placeholder="name@example.com" required />
        <Field id="password" name="password" type="password" label="비밀번호" autoComplete="new-password" minLength={6} required hint="6자 이상" />
        <FormMessage>{error}</FormMessage>
        <Button type="submit" block disabled={busy}>{busy ? '만드는 중…' : '계정 만들기'}</Button>
      </form>
    </AuthLayout>
  );
}
