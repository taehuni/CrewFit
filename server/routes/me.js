import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/me — 토큰 검증 확인 + profiles·user_settings 반환. RLS가 본인 행만 돌려줌 (api.md #2)
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await req.db
    .from('profiles')
    .select('*, user_settings(*)')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: { code: error.code, message: error.message } });
  if (!data) return res.status(404).json({ error: { code: 'no_profile', message: '프로필 없음 (가입 트리거 확인)' } });

  const { user_settings, ...profile } = data;
  res.json({ user: { id: req.user.id, email: req.user.email }, profile, settings: user_settings });
});

export default router;
