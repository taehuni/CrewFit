import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from './AuthContext.jsx';
import { initialAuthLink } from './authLinks.js';
import { safeAuthNext } from './googleAuth.js';
import { supabase } from '../../shared/supabaseClient.js';
import AuthLayout from './AuthLayout.jsx';

export default function GoogleCallbackPage() {
  const { loading, session, initializationError } = useAuth();
  const navigate = useNavigate();
  const [next] = useState(() => safeAuthNext(new URLSearchParams(window.location.search).get('next')));
  const [calendar] = useState(()=>new URLSearchParams(window.location.search).get('calendar')==='1');
  const [calendarRequest] = useState(()=>{try{return JSON.parse(sessionStorage.getItem('crewfit-calendar-connect'));}catch{return null;}});
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (loading) return;
    let active = true;
    window.history.replaceState(window.history.state, '', '/auth/google');
    if (initialAuthLink.error || initializationError || !initialAuthLink.present || !session?.user?.identities?.some(identity => identity.provider === 'google')) {
      setError('구글 로그인이 취소되었거나 완료되지 않았어요. 로그인 화면에서 다시 시작해 주세요.');
      return;
    }
    if(calendar){
      if(!calendarRequest||calendarRequest.userId!==session.user.id||Date.now()-calendarRequest.at>900000||!session.provider_token){setError('캘린더 연결이 완료되지 않았어요. 기존 CrewFit 계정과 같은 구글 계정으로 다시 연결해 주세요.');return;}
      sessionStorage.removeItem('crewfit-calendar-connect');navigate('/me?calendar=connected#profile-connections',{replace:true});return;
    }
    setError('');
    supabase.from('profiles').select('main_sport,user_settings(*)').eq('id', session.user.id).single().then(({ data, error: failure }) => {
      if (!active) return;
      if (failure) return setError('로그인은 완료됐지만 프로필을 확인하지 못했어요. 다시 확인해 주세요.');
      navigate((data.user_settings?.interested_sports != null || data.main_sport) ? next : '/me?welcome=google', { replace: true });
    }).catch(() => { if (active) setError('프로필을 확인하지 못했어요. 다시 확인해 주세요.'); });
    return () => { active = false; };
  }, [loading, session, initializationError, navigate, next, attempt, calendar, calendarRequest]);
  return <AuthLayout title={<>반가워요.<br/>함께 시작해요.</>} heading="구글 로그인" description="계정과 운동 프로필을 확인하고 있어요.">
    {error ? <><p role="alert">{error}</p>{session && !initialAuthLink.error && <button className="btn btn-ghost btn-block" onClick={() => setAttempt(value => value + 1)}>다시 확인</button>}<Link className="btn btn-primary btn-block" to="/login">로그인 화면으로</Link></> : <p role="status">로그인 확인 중…</p>}
  </AuthLayout>;
}




