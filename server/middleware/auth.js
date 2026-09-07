import { createUserClient } from '../config/supabase.js';

// 보호 라우트에 붙임. 클라가 supabase-js로 로그인 후 Authorization: Bearer <access_token> 로 보낸 토큰을
// 검증하고 req.user(사용자) + req.db(그 사용자 JWT로 만든 RLS 적용 클라이언트)를 부착 (D-15).
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: { code: 'no_token', message: '토큰 없음' } });

  const db = createUserClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: { code: 'invalid_token', message: '토큰이 유효하지 않음' } });
  }
  req.user = data.user;
  req.db = db;
  next();
}
