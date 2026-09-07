import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext.jsx';

// 보호 라우트. 세션 확인 전엔 아무것도 안 그리고(깜빡임 방지), 없으면 /login으로.
export default function RequireAuth() {
  const { loading, session } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center">불러오는 중…</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

// 로그인 상태에서 /login 등에 오면 홈으로.
export function GuestOnly() {
  const { loading, session } = useAuth();
  if (loading) return <div className="center">불러오는 중…</div>;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}
