import { Router } from 'express';
import { joinCrew, moderateCrewRequest } from '../services/crewMembership.js';
import { matchCrews } from '../services/matching.js';
import { loadCrewStats } from '../services/crewStats.js';

export function createCrewsRouter(requireAuth, join = joinCrew, moderate = moderateCrewRequest, match = matchCrews, stats = loadCrewStats) {
  const router=Router();
  router.get('/:id/stats', requireAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(await stats(req.db, req.user.id, req.params.id, req.query.period ?? 'week')); }
    catch (error) {
      const known = Number.isInteger(error.status);
      res.status(known ? error.status : 500).json({error: {
        code: known ? error.code : 'STATS_FAILED',
        message: known ? error.message : '크루 통계를 불러오지 못했어요.',
      }});
    }
  });
  router.get('/match', requireAuth, async (req, res) => {
    try { res.json(await match(req.db, req.user.id)); }
    catch (error) {
      const known = Number.isInteger(error.status);
      res.status(known ? error.status : 500).json({error: {
        code: known ? error.code : 'MATCH_FAILED',
        message: known ? error.message : '추천 크루를 불러오지 못했어요.',
      }});
    }
  });
  router.post('/:id/join',requireAuth,async(req,res)=>{
    try { res.json(await join(req.db,req.user.id,req.params.id)); }
    catch(error) {
      const known=Number.isInteger(error.status);
      res.status(known?error.status:500).json({error:{code:known?error.code:'JOIN_FAILED',message:known?error.message:'가입 결과를 확인하지 못했어요. 다시 조회해 주세요.'}});
    }
  });
  for (const action of ['approve', 'reject']) {
    router.post(`/:id/${action}`, requireAuth, async (req, res) => {
      try { res.json(await moderate(req.db, req.user.id, req.params.id, req.body?.user_id, action)); }
      catch (error) {
        const known = Number.isInteger(error.status);
        res.status(known ? error.status : 500).json({error: {
          code: known ? error.code : 'MODERATION_FAILED',
          message: known ? error.message : '가입 요청을 처리하지 못했어요. 다시 조회해 주세요.',
        }});
      }
    });
  }
  return router;
}
