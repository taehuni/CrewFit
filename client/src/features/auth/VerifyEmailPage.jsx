import { Link, Navigate, useLocation } from 'react-router';
import AuthLayout from './AuthLayout.jsx';
import { useAuth } from './AuthContext.jsx';
import ConfirmationForm from './ConfirmationForm.jsx';
import { Capacitor } from '@capacitor/core';

export default function VerifyEmailPage() {
  const { session, loading } = useAuth();
  const { state } = useLocation();
  if (loading) return <div className="center" role="status">계정 확인 중…</div>;
  if (session) return <Navigate to="/home" replace />;
  return <AuthLayout title={<>첫 기록까지,<br />한 걸음 남았어요.</>} heading="이메일을 확인해 주세요"
    description="가입한 이메일의 인증 링크를 열면 크루핏을 시작할 수 있어요."
    footer={<p><Link to="/login">로그인</Link> · <Link to="/signup">다른 이메일로 가입</Link></p>}>
    {new URLSearchParams(window.location.search).get('nativeAuth') === 'failed' && <p role="alert">링크를 확인하지 못했어요. 아래에서 새 메일을 요청한 뒤 가장 최근 링크를 열어 주세요.</p>}
    {Capacitor.isNativePlatform() && <p className="muted small">메일은 지금 사용 중인 휴대폰에서 열어 주세요. 인증을 마치면 CrewFit 앱으로 돌아와요.</p>}
    <ConfirmationForm initialEmail={state?.email || ''} initiallySent={state?.sent === true} />
  </AuthLayout>;
}
