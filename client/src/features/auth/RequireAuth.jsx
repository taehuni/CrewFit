import { safeAuthNext } from './googleAuth.js';
import {useState} from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext.jsx';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '../../shared/api.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {needsProfileCompletion} from './profileCompletion.js';
import {requiredProfileQuery,requiredProfileError} from './requiredProfile.js';
import CompleteProfile from './CompleteProfile.jsx';

// 보호 라우트. 세션 확인 전엔 아무것도 안 그리고(깜빡임 방지), 없으면 /login으로.
export default function RequireAuth() {
  const { loading, session } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center">불러오는 중…</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <ProfileGate key={session.user.id}/>;
}

function ProfileGate(){
 const {user,token,signOut}=useAuth(),cache=useQueryClient();
 const [stopped,setStopped]=useState(false);
 const google=user.identities?.some(i=>i.provider==='google')||user.app_metadata?.providers?.includes('google');
 const me=useQuery(requiredProfileQuery(api,{userId:user.id,token,enabled:!!google&&!stopped}));
 function stopCheck(){setStopped(true);void cache.cancelQueries({queryKey:queryKeys.me(user.id),exact:true});}
 function retry(){if(stopped)setStopped(false);else void me.refetch();}
 if(!google)return <Outlet/>;
 if(stopped||me.isError)return <div className="center"><section className="card stack"><p role={stopped?'status':'alert'}>{stopped?'가입 정보 확인을 멈췄어요. 다시 확인한 뒤 계속할 수 있어요.':requiredProfileError(me.error)}</p><button className="btn btn-primary" disabled={me.isFetching} onClick={retry}>{me.isFetching?'다시 확인 중…':'다시 확인'}</button><button className="btn btn-ghost" onClick={signOut}>로그아웃</button></section></div>;
 if(me.isPending)return <div className="center"><section className="card stack"><p role="status">가입 정보를 확인하고 있어요…</p><p>연결 상태에 따라 잠시 걸릴 수 있어요.</p><button className="btn btn-ghost" onClick={stopCheck}>확인 중단</button></section></div>;
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
