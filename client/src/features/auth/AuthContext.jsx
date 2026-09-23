import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../shared/supabaseClient.js';
import { queryClient } from '../../shared/queryClient.js';
import { initialAuthLink } from './authLinks.js';

const AuthContext = createContext(null);

// 세션은 supabase-js가 localStorage에 관리(D-12). 여기는 그걸 React 상태로 비추기만.
// session: undefined = 아직 모름(초기 로딩), null = 로그아웃, 객체 = 로그인.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [initializationError, setInitializationError] = useState(null);
  const [initialized, setInitialized] = useState(false);

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
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용');
  return ctx;
}
