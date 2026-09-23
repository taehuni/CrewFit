import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadStreak, loadWeeklyDashboard, weekRange } from '../services/dashboard.js';
import { loadGoalProgress } from '../services/goalProgress.js';

const router = Router();
router.get('/', requireAuth, async (req, res) => {
  let range;
  try {
    if (req.query.period != null && req.query.period !== 'week') throw new Error('invalid_period');
    range = weekRange(req.query.date);
  } catch {
    return res.status(400).json({ error: { code: 'invalid_period', message: 'period=week와 올바른 날짜(YYYY-MM-DD)를 입력해 주세요.' } });
  }
  try {
    const [dashboard, goals, streak] = await Promise.all([
      loadWeeklyDashboard(req.db, req.user.id, range),
      loadGoalProgress(req.db, req.user.id),
      loadStreak(req.db, req.user.id),
    ]);
    res.json({ ...dashboard, goals, streak });
  } catch {
    res.status(500).json({ error: { code: 'dashboard_failed', message: '운동 기록을 불러오지 못했어요. 다시 시도해 주세요.' } });
  }
});
export default router;
