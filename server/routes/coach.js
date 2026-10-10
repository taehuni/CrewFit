import {saveMealPlan,validateNutrition} from '../services/nutrition.js';
import {Router} from 'express';
import {chat,checked,savePlans,uuid} from '../services/coach.js';
export function createCoachRouter(requireAuth){
 const router=Router();router.use(requireAuth);
 const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||502).json({error:{message:e.status?e.message:'요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'}});}};
 router.get('/',run(async req=>{const [turns,plans]=await Promise.all([req.db.from('coach_turns').select('*').eq('user_id',req.user.id).order('created_at',{ascending:false}).limit(30),req.db.from('workout_plans').select('*').eq('user_id',req.user.id).order('scheduled_on',{ascending:false}).limit(100)]);return {turns:checked(turns).reverse(),plans:checked(plans)};}));
 router.get('/nutrition',run(async req=>{const [prefs,plans]=await Promise.all([req.db.from('nutrition_preferences').select('*').eq('user_id',req.user.id).maybeSingle(),req.db.from('meal_plans').select('*').eq('user_id',req.user.id).order('scheduled_on',{ascending:false}).limit(100)]);return {preferences:checked(prefs),plans:checked(plans)};}));
 router.put('/nutrition',run(async req=>checked(await req.db.from('nutrition_preferences').upsert({...validateNutrition(req.body),user_id:req.user.id}).select().single())));
 router.post('/meal-plans',run(req=>saveMealPlan(req.db,req.user.id,req.body)));
 router.delete('/meal-plans/:id',run(async req=>{if(!uuid(req.params.id))throw Object.assign(new Error('올바른 식단이 아니에요.'),{status:400});checked(await req.db.from('meal_plans').delete().eq('user_id',req.user.id).eq('id',req.params.id));return {ok:true};}));
 router.post('/chat',run(req=>chat(req.db,req.user.id,req.body)));
 router.post('/plans',run(req=>savePlans(req.db,req.user.id,req.body)));
 router.delete('/plans/:id',run(async req=>{if(!uuid(req.params.id))throw Object.assign(new Error('올바른 일정이 아니에요.'),{status:400});checked(await req.db.from('workout_plans').delete().eq('user_id',req.user.id).eq('id',req.params.id));return {ok:true};}));
 return router;
}
