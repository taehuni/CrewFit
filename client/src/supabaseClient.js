import { createClient } from '@supabase/supabase-js';

// anon 키는 클라이언트 노출 전제(RLS로 보호). service_role 키는 여기 넣지 말 것.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
