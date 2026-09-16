import { createClient } from '@supabase/supabase-js';
import { requiredEnv } from './env.js';

// D-15: 서버도 기본은 사용자 JWT로 접근해 RLS를 그대로 받는다.
// 인증 필수 설정은 부팅 시 검사해 설정 오류가 사용자 토큰 오류로 보이지 않게 한다.
const url = requiredEnv('SUPABASE_URL');
const anonKey = requiredEnv('SUPABASE_ANON_KEY');
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

// 요청마다 생성. anon 키 + 사용자 access_token → 모든 쿼리에 RLS 적용 (auth.uid() = 그 사용자).
export function createUserClient(token) {
  return createClient(url, anonKey, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// RLS 우회. 사용처는 services/crewStats.js · services/feedback.js 두 파일만 (routes/ import 금지).
export const supabaseAdmin = createClient(
  url,
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
  noSession
);
