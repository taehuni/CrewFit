import {Router} from 'express';
import {listBody,createBody,updateBody,deleteBody} from '../services/body.js';
export function createBodyRouter(requireAuth){
 const router=Router();router.use(requireAuth);
 const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(error){res.status(error.status||502).json({error:{message:error.status?error.message:'체성분 기록을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'}});}};
 router.get('/',run(req=>listBody(req.db,req.user.id)));
 router.post('/',run(req=>createBody(req.db,req.user.id,req.body)));
 router.put('/:id',run(req=>updateBody(req.db,req.user.id,req.params.id,req.body)));
 router.delete('/:id',run(req=>deleteBody(req.db,req.user.id,req.params.id)));
 return router;
}
