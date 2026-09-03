import { createClient } from '@supabase/supabase-js';

// 서버 전용 클라이언트. service_role 키는 RLS를 우회하므로 절대 클라이언트로 노출 금지.
// placeholder는 .env 미설정 시 부팅만 되게 하는 용도 — 실제 호출은 크레덴셜 채워야 동작.
export const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
  { auth: { persistSession: false } }
);
