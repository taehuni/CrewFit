import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/supabaseClient.js';
import { queryClient } from '../../shared/queryClient.js';
import { initialAuthLink } from './authLinks.js';
import { isNativeTracking, nativeTracking } from '../tracking/nativeTracking.js';
import { calendarRequestFromUrl, calendarReturnProblem } from './calendarConnection.js';
import { createCalendarSessionStore, clearRejectedCalendarSession } from './calendarSession.js';
import { sessionDrafts } from '../../shared/sessionDrafts.js';

const AuthContext = createContext(null);

// CrewFit 세션은 SDK가 관리한다. 단기 Google 토큰은 같은 사용자·탭에 한해 보존한다.
// session: undefined = 아직 모름(초기 로딩), null = 로그아웃, 객체 = 로그인.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [initializationError, setInitializationError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [calendarStore] = useState(() => {
    let storage; try { storage = window.sessionStorage; } catch {}
    return createCalendarSessionStore({ storage });
  });
  const [calendarReturn] = useState(() => {
    let stored; try { stored = JSON.parse(sessionStorage.getItem('crewfit-calendar-connect')); } catch {}
    return { calendar: new URLSearchParams(window.location.search).get('calendar') === '1', authLink: initialAuthLink,
      stored, returned: calendarRequestFromUrl(window.location.href) };
  });
  const [calendarAccountIssue, setCalendarAccountIssue] = useState(null);
  const calendarGuard = useRef({ checked: false, rejected: false, freshProvider: initialAuthLink.present && !initialAuthLink.error });
  const currentSession = useRef(null);
  const previousOwner = useRef(null);

  async function finishCalendarSignOut(problem) {
    const cleared = await clearRejectedCalendarSession(supabase.auth);
    if (cleared) { try { sessionStorage.removeItem('crewfit-calendar-connect'); } catch {} }
    setCalendarAccountIssue({ problem, cleared, cleaning: false });
  }

  useEffect(() => {
    if (!initialized || !isNativeTracking()) return;
    const owner = session?.user?.id || null;
    if (!owner || (previousOwner.current && previousOwner.current !== owner)) {
      void nativeTracking.suspend().catch(() => setTrackingError('GPS 측정 상태를 확인하지 못했어요. 진행 알림에서 종료하거나 앱을 다시 열어 주세요.'));
    }
    previousOwner.current = owner;
  }, [initialized, session?.user?.id]);

  useEffect(() => {
    let active = true;
    function receive(next) {
      if (!active) return;
      const previousId = currentSession.current?.user?.id;
      const nextId = next?.user?.id;
      sessionDrafts.retainOwner(nextId);
      if (!nextId || (previousId && previousId !== nextId)) queryClient.clear();
      if (!calendarGuard.current.checked && nextId) {
        calendarGuard.current.checked = true;
        const problem = calendarReturnProblem({ ...calendarReturn, session: next });
        if (problem) {
          calendarGuard.current.rejected = true;
          // Keep the quarantine across reloads if local sign-out cannot finish.
          try { sessionStorage.setItem('crewfit-calendar-connect', JSON.stringify({
            ...(calendarReturn.returned || calendarReturn.stored), rejectedUserId: nextId, problem,
          })); } catch {}
          calendarStore.clear(); sessionDrafts.clear(); queryClient.clear(); currentSession.current = null; setSession(null);
          setCalendarAccountIssue({ problem, cleared: false, cleaning: true });
          // Leave the SDK auth callback before starting another auth operation.
          setTimeout(() => { void finishCalendarSignOut(problem); }, 0);
          return;
        }
      }
      if (calendarGuard.current.rejected) { calendarStore.clear(); setSession(null); return; }
      const nextSession = calendarStore.apply(next, { freshProvider: calendarGuard.current.freshProvider });
      if (next?.provider_token) calendarGuard.current.freshProvider = false;
      currentSession.current = nextSession; setSession(nextSession);
    }
    supabase.auth.initialize().then(async ({ error }) => {
      const result = await supabase.auth.getSession();
      if (active) { setInitializationError(error || result.error); receive(result.data?.session ?? null); setInitialized(true); }
    }).catch(() => {
      if (active) { setInitializationError(new Error('인증 확인 실패')); receive(null); setInitialized(true); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      receive(next);
      if (event === 'SIGNED_OUT') queryClient.clear(); // D-13: 다른 계정 데이터 잔류 방지
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    token: session?.access_token ?? null,
    loading: !initialized,
    initializationError: initialAuthLink.error ? new Error('유효하지 않은 인증 링크') : initializationError,
    calendarIssue: calendarStore.issue(),
    calendarAccountIssue,
    retryCalendarSignOut: () => {
      if (calendarAccountIssue?.cleaning) return;
      setCalendarAccountIssue({ ...calendarAccountIssue, cleaning: true });
      void finishCalendarSignOut(calendarAccountIssue?.problem);
    },
    invalidateCalendarProvider: (owner, provider, message) => {
      if (calendarStore.invalidate(owner, provider, message)) {
        const next = calendarStore.apply(currentSession.current);
        currentSession.current = next; setSession(next);
      }
    },
    signOut: async () => {
      setTrackingError('');
      if (isNativeTracking()) {
        try { await nativeTracking.suspend(); }
        catch (error) { setTrackingError('GPS 측정을 종료하지 못해 로그아웃을 멈췄어요. 측정 화면에서 종료한 뒤 다시 시도해 주세요.'); return { error }; }
      }
      return supabase.auth.signOut();
    },
  };
  return <AuthContext.Provider value={value}>{trackingError && <div className="auth-session-notice" role="alert">{trackingError}<button type="button" onClick={() => setTrackingError('')}>닫기</button></div>}{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용');
  return ctx;
}
