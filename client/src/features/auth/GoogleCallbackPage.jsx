import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from './AuthContext.jsx';
import { initialAuthLink } from './authLinks.js';
import { safeAuthNext } from './googleAuth.js';
import { supabase } from '../../shared/supabaseClient.js';
import AuthLayout from './AuthLayout.jsx';
import {calendarRequestFromUrl,calendarReturnRequest,verifyCalendarConnection} from './calendarConnection.js';
import {api} from '../../shared/api.js';

export default function GoogleCallbackPage() {
  const { loading, session, initializationError, calendarIssue, calendarAccountIssue, retryCalendarSignOut, invalidateCalendarProvider } = useAuth();
  const navigate = useNavigate();
  const [next] = useState(() => safeAuthNext(new URLSearchParams(window.location.search).get('next')));
  const [calendar] = useState(()=>new URLSearchParams(window.location.search).get('calendar')==='1');
  const [calendarRequest] = useState(()=>{try{return JSON.parse(sessionStorage.getItem('crewfit-calendar-connect'));}catch{return null;}});
  const [returnedRequest] = useState(()=>calendarRequestFromUrl(window.location.href));
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (loading) return;
    let active = true;
    if(calendarAccountIssue){
      if(calendarAccountIssue.cleaning)return;
      if(!calendarAccountIssue.cleared)return;
      window.history.replaceState(window.history.state, '', '/auth/google');
      try{sessionStorage.removeItem('crewfit-calendar-connect');}catch{}
      return;
    }
    window.history.replaceState(window.history.state, '', '/auth/google');
    if (initialAuthLink.error || initializationError || !initialAuthLink.present || !session?.user?.identities?.some(identity => identity.provider === 'google')) {
      if(calendar){try{sessionStorage.removeItem('crewfit-calendar-connect');}catch{}}
      setError(calendar?'캘린더 연결이 취소되었거나 완료되지 않았어요. 같은 CrewFit 계정으로 연결 설정에서 다시 시작해 주세요.':'구글 로그인이 취소되었거나 완료되지 않았어요. 로그인 화면에서 다시 시작해 주세요.');
      return;
    }
    if(calendar){
      if(!calendarReturnRequest(calendarRequest,returnedRequest,session.user.id)||!session.provider_token){setError(calendarIssue||'캘린더 연결이 완료되지 않았어요. 기존 CrewFit 계정과 같은 구글 계정으로 다시 연결해 주세요.');return;}
      setError('');
      verifyCalendarConnection(api,session).then(result=>{
        if(!active)return;
        if(!result.connected){setError(result.reason||'캘린더 권한을 확인하지 못했어요. 다시 연결해 주세요.');return;}
        try{sessionStorage.removeItem('crewfit-calendar-connect');}catch{}
        navigate('/me/settings?calendar=connected#profile-connections',{replace:true});
      }).catch(failure=>{if(active){if(['calendar_reconnect','calendar_permission','calendar_account_mismatch'].includes(failure.code))invalidateCalendarProvider(session.user.id,session.provider_token,failure.message);setError(failure.message);}});
      return()=>{active=false;};
    }
    setError('');
    supabase.from('profiles').select('main_sport,user_settings(*)').eq('id', session.user.id).single().then(({ data, error: failure }) => {
      if (!active) return;
      if (failure) return setError('로그인은 완료됐지만 프로필을 확인하지 못했어요. 다시 확인해 주세요.');
      navigate(next, { replace: true });
    }).catch(() => { if (active) setError('프로필을 확인하지 못했어요. 다시 확인해 주세요.'); });
    return () => { active = false; };
  }, [loading, session, initializationError, navigate, next, attempt, calendar, calendarRequest, returnedRequest, calendarAccountIssue, calendarIssue]);
  return <AuthLayout title={calendar?<>내 계획을<br/>캘린더에 연결해요.</>:<>반가워요.<br/>함께 시작해요.</>} heading={calendar?'캘린더 연결':'구글 로그인'} description={calendar?'계정과 캘린더 사용 권한을 확인하고 있어요.':'계정과 운동 프로필을 확인하고 있어요.'}>
    {calendarAccountIssue?<><p role={calendarAccountIssue.cleaning?'status':'alert'}>{calendarAccountIssue.cleaning?'연결을 중단하고 선택된 계정의 로그인 상태를 정리하고 있어요…':calendarAccountIssue.cleared?(calendarAccountIssue.problem==='account_mismatch'?'다른 Google 계정이 선택되어 캘린더 연결을 중단하고 이 브라우저에서 로그아웃했어요. 기존 CrewFit 계정으로 다시 로그인해 주세요.':'연결 요청을 확인하지 못해 이 브라우저에서 로그아웃했어요. 기존 CrewFit 계정으로 다시 로그인하고 연결해 주세요.'):'연결은 중단했지만 로그아웃을 마치지 못했어요. 다시 시도한 뒤 기존 CrewFit 계정으로 로그인해 주세요.'}</p>{calendarAccountIssue.cleared?<a className="btn btn-primary btn-block" href="/login">기존 계정으로 다시 로그인</a>:!calendarAccountIssue.cleaning&&<button className="btn btn-primary btn-block" onClick={retryCalendarSignOut}>로그아웃 다시 시도</button>}</>:error ? <><p role="alert">{error}</p>{session && !initialAuthLink.error && (!calendar||session.provider_token) && <button className="btn btn-ghost btn-block" onClick={() => setAttempt(value => value + 1)}>다시 확인</button>}<Link className="btn btn-primary btn-block" to={calendar&&session?'/me/settings?calendar=settings#profile-connections':'/login'}>{calendar&&session?'캘린더 연결 설정으로':'로그인 화면으로'}</Link></> : <p role="status">{calendar?'캘린더 연결 확인 중…':'로그인 확인 중…'}</p>}
  </AuthLayout>;
}




