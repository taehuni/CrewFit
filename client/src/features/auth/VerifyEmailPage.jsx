import { Link, Navigate, useLocation } from 'react-router';
import AuthLayout from './AuthLayout.jsx';
import { useAuth } from './AuthContext.jsx';
import ConfirmationForm from './ConfirmationForm.jsx';

export default function VerifyEmailPage() {
  const { session, loading } = useAuth();
  const { state } = useLocation();
  if (loading) return <div className="center" role="status">계정 확인 중…</div>;
  if (session) return <Navigate to="/home" replace />;
  return <AuthLayout title={<>첫 기록까지,<br />한 걸음 남았어요.</>} heading="이메일을 확인해 주세요"
    description="가입한 이메일의 인증 링크를 열면 크루핏을 시작할 수 있어요."
    footer={<p><Link to="/login">로그인</Link> · <Link to="/signup">다른 이메일로 가입</Link></p>}>
    <ConfirmationForm initialEmail={state?.email || ''} initiallySent={state?.sent === true} />
  </AuthLayout>;
}
