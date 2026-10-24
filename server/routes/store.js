import {Router} from 'express';
import {listStoreProducts,getStoreProduct} from '../services/store.js';
export function createStoreRouter(requireAuth){
  const router=Router();router.use(requireAuth);
  router.get('/products',async(req,res)=>{
    try{res.json(await listStoreProducts(req.query.category||'foods',req.query.q||''));}
    catch(e){res.status(e.status||502).json({error:{message:e.status===400?e.message:e.status===503?'상품 연결을 준비 중이에요.':'상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}});}
  });
  router.get('/products/:id',async(req,res)=>{
    try{res.json(await getStoreProduct(req.params.id));}
    catch(e){res.status(e.status||502).json({error:{message:e.status===404?e.message:'상품 상세를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}});}
  });return router;
}
