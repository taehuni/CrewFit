import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/supabaseClient.js';
import { queryClient } from '../../shared/queryClient.js';
import { initialAuthLink } from './authLinks.js';
import { isNativeTracking, nativeTracking } from '../tracking/nativeTracking.js';

const AuthContext = createContext(null);

// 세션은 supabase-js가 localStorage에 관리(D-12). 여기는 그걸 React 상태로 비추기만.
// session: undefined = 아직 모름(초기 로딩), null = 로그아웃, 객체 = 로그인.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [initializationError, setInitializationError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const previousOwner = useRef(null);

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
    supabase.auth.initialize().then(async ({ error }) => {
      const result = await supabase.auth.getSession();
      if (active) { setInitializationError(error || result.error); setSession(result.data?.session ?? null); setInitialized(true); }
    }).catch(() => {
      if (active) { setInitializationError(new Error('인증 확인 실패')); setSession(null); setInitialized(true); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
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
