import { createClient } from '@supabase/supabase-js';

// D-15: 서버도 기본은 사용자 JWT로 접근해 RLS를 그대로 받는다.
// placeholder는 .env 미설정 시 부팅만 되게 하는 용도 — 실제 호출은 크레덴셜 채워야 동작.
const url = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.SUPABASE_ANON_KEY || 'placeholder';
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
