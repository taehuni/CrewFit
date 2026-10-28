import { safeAuthNext } from './googleAuth.js';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext.jsx';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../shared/api.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {needsProfileCompletion} from './profileCompletion.js';
import CompleteProfile from './CompleteProfile.jsx';

// 보호 라우트. 세션 확인 전엔 아무것도 안 그리고(깜빡임 방지), 없으면 /login으로.
export default function RequireAuth() {
  const { loading, session } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center">불러오는 중…</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <ProfileGate/>;
}

function ProfileGate(){
 const {user,token,signOut}=useAuth();
 const google=user.identities?.some(i=>i.provider==='google')||user.app_metadata?.providers?.includes('google');
 const me=useQuery({queryKey:queryKeys.me(user.id),queryFn:()=>api('/me',{token}),enabled:!!google,retry:false});
 if(!google)return <Outlet/>;
 if(me.isPending)return <div className="center" role="status">가입 정보를 확인하고 있어요…</div>;
 if(me.isError)return <div className="center"><section className="card stack"><p role="alert">가입 정보를 확인하지 못했어요.</p><button className="btn btn-primary" onClick={()=>me.refetch()}>다시 확인</button><button className="btn btn-ghost" onClick={signOut}>로그아웃</button></section></div>;
 return needsProfileCompletion(user,me.data)?<CompleteProfile me={me.data}/>:<Outlet/>;
}

// 로그인 상태에서 /login 등에 오면 홈으로.
export function GuestOnly() {
  const { loading, session } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center">불러오는 중…</div>;
  if (session) return <Navigate to={safeAuthNext(location.state?.from)} replace />;
  return <Outlet />;
}
