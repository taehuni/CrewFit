import { supabase } from '../config/supabase.js';

// 보호 라우트에 붙여서 req.user 채움. 클라가 supabase-js로 로그인 후
// Authorization: Bearer <access_token> 로 보낸 걸 Supabase에 물어봐서 검증.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: '토큰 없음' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ message: '토큰이 유효하지 않음' });
  }
  req.user = data.user;
  next();
}
