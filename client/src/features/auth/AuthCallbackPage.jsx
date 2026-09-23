import { useEffect } from 'react';
import { Link } from 'react-router';
import AuthLayout from './AuthLayout.jsx';
import { useAuth } from './AuthContext.jsx';
import { initialAuthLink } from './authLinks.js';
import ConfirmationForm from './ConfirmationForm.jsx';

export default function AuthCallbackPage() {
  const { loading, session, initializationError } = useAuth();
  const success = !initialAuthLink.error && !initializationError && initialAuthLink.present && Boolean(session);
  useEffect(() => {
    // The SDK must finish consuming credentials before cleaning the address bar.
    if (!loading) window.history.replaceState(window.history.state, '', '/auth/callback');
  }, [loading]);
  if (loading) return <div className="center" role="status">인증 링크 확인 중…</div>;
  return <AuthLayout title={<>이제 함께,<br />운동을 이어가요.</>}
    heading={success ? '이메일 인증이 완료됐어요' : '인증 링크를 확인해 주세요'}
    description={success ? '계정이 확인됐어요. 첫 운동을 기록해 보세요.' : '링크가 만료됐거나 이미 사용됐을 수 있어요. 인증을 마쳤다면 로그인하고, 아직이라면 새 메일을 받아 주세요.'}
    footer={<Link to="/login">로그인으로 이동</Link>}>
    {success ? <Link to="/home" className="btn btn-primary btn-block">내 운동으로</Link> : <ConfirmationForm />}
  </AuthLayout>;
}
