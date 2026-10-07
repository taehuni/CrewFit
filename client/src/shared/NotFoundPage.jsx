import { Link } from 'react-router';
import { useAuth } from '../features/auth/index.js';

export default function NotFoundPage() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center" role="status">불러오는 중…</p>;
  return <main className="not-found">
    <p className="muted">CREWFIT · 404</p>
    <h1>페이지를 찾을 수 없어요.</h1>
    <p>주소가 잘못되었거나 이동한 페이지일 수 있어요.</p>
    <Link className="btn btn-primary" to={user ? '/home' : '/'}>{user ? '홈으로 돌아가기' : '첫 화면으로 돌아가기'}</Link>
  </main>;
}
