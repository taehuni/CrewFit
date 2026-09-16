import { Router } from 'express';
import { mergeExerciseNames } from '../services/exercises.js';

// Inject authentication so HTTP tests never need a real token or database.
export function createExercisesRouter(requireAuth) {
  const router = Router();
  router.post('/merge', requireAuth, async (req, res) => {
    try {
      res.json(await mergeExerciseNames(req.db, req.body));
    } catch (error) {
      const known = Number.isInteger(error.status);
      res.status(known ? error.status : 500).json({ error: {
        code: known ? error.code : 'MERGE_FAILED',
        message: known ? error.message : '변경 결과를 확인하지 못했어요. 기록을 새로 조회해 주세요.',
      } });
    }
  });
  return router;
}
