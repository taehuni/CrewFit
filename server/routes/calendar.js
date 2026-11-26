import {Router} from 'express';
import {exportPlan,checkCalendarConnection} from '../services/calendar.js';
export function createCalendarRouter(requireAuth){
 const r=Router();r.use(requireAuth);
 r.post('/connection',async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await checkCalendarConnection(req.user,req.body?.providerToken));}catch(e){const known=[401,403,502,503].includes(e.status);res.status(known?e.status:502).json({error:{code:known?e.code:'calendar_unreachable',message:known?e.message:'구글 연결을 확인하지 못했어요. 잠시 후 다시 확인해 주세요.'}});}});
 r.get('/exports',async(req,res)=>{const result=await req.db.from('calendar_exports').select('plan_id,event_url').eq('user_id',req.user.id);if(result.error)return res.status(503).json({error:{message:'캘린더 저장 설정이 아직 완료되지 않았어요.'}});res.json(result.data);});
 r.post('/plans/:id',async(req,res)=>{try{res.json(await exportPlan(req.db,req.user,req.params.id,req.body?.providerToken));}catch(e){res.status(e.status||502).json({error:{message:e.status?e.message:'캘린더 요청을 완료하지 못했어요.'}});}});return r;
}
