import { Router } from 'express';
import { generateFeedback } from '../services/feedback.js';

export function createFeedbackRouter(requireAuth, generate = generateFeedback) {
  const router = Router();
  router.post('/generate', requireAuth, async (req, res) => {
    try {
      res.json(await generate({ db: req.db, userId: req.user.id, input: req.body }));
    } catch (error) {
      const known = Number.isInteger(error.status);
      res.status(known ? error.status : 500).json({ error: {
        code: known ? error.code : 'FEEDBACK_FAILED',
        message: known ? error.message : '피드백 생성 결과를 확인하지 못했어요.',
      } });
    }
  });
  return router;
}
