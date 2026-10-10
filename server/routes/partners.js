import {Router} from 'express';
import {partnerCatalog} from '../services/partnerCatalog.js';
import {createReservation,changeReservation} from '../services/partners.js';
export function createPartnersRouter(requireAuth){
 const r=Router();r.use(requireAuth);const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||502).json({error:{message:e.status?e.message:'예약 요청을 완료하지 못했어요.'}});}};
 r.get('/',(req,res)=>res.json({facilities:partnerCatalog,mode:'simulation',demo:true}));
 r.get('/reservations',run(async req=>{const result=await req.db.from('partner_reservations').select('*').eq('user_id',req.user.id).order('created_at',{ascending:false}).limit(100);if(result.error)throw Object.assign(new Error('예약 저장 설정이 아직 완료되지 않았어요.'),{status:503});return result.data;}));
 r.post('/reservations',run(req=>createReservation(req.user.id,req.body)));
 r.post('/reservations/:id/simulate',run(req=>changeReservation(req.user.id,req.params.id,'simulate')));
 r.post('/reservations/:id/cancel',run(req=>changeReservation(req.user.id,req.params.id,'cancel')));
 return r;
}
