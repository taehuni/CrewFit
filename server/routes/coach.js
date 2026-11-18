import {coachWorkspace,listWorkoutPlans,updateWorkoutPlan,createWorkoutPlan,listMealPlans} from '../services/workoutPlans.js';
import {coachHistory} from '../services/coachHistory.js';
import {saveMealPlan,validateNutrition} from '../services/nutrition.js';
import {Router} from 'express';
import {chat,checked,savePlans,uuid} from '../services/coach.js';
export function createCoachRouter(requireAuth){
 const router=Router();router.use(requireAuth);
 const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||502).json({error:{message:e.status?e.message:'요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'}});}};
 router.get('/',run(req=>coachWorkspace(req.db,req.user.id,req.query)));
 router.get('/plans',run(req=>listWorkoutPlans(req.db,req.user.id,req.query)));
 router.put('/plans/:id',run(req=>updateWorkoutPlan(req.db,req.user.id,req.params.id,req.body)));
 router.post('/plans/manual',run(req=>createWorkoutPlan(req.db,req.user.id,req.body)));
 router.get('/meal-plans',run(req=>listMealPlans(req.db,req.user.id,req.query)));
 router.get('/history',run(req=>coachHistory(req.db,req.user.id,req.query)));
 router.get('/nutrition',run(async req=>{const turn=req.query.turn_id;if(turn!==undefined&&!uuid(turn))throw Object.assign(new Error('대화를 확인해 주세요.'),{status:400});const [prefs,plans]=await Promise.all([req.db.from('nutrition_preferences').select('*').eq('user_id',req.user.id).maybeSingle(),turn?req.db.from('meal_plans').select('*').eq('user_id',req.user.id).eq('turn_id',turn).order('position').limit(7):Promise.resolve({data:[]})]);return {preferences:checked(prefs),plans:checked(plans)};}));
 router.put('/nutrition',run(async req=>checked(await req.db.from('nutrition_preferences').upsert({...validateNutrition(req.body),user_id:req.user.id}).select().single())));
 router.post('/meal-plans',run(req=>saveMealPlan(req.db,req.user.id,req.body)));
 router.delete('/meal-plans/:id',run(async req=>{if(!uuid(req.params.id))throw Object.assign(new Error('올바른 식단이 아니에요.'),{status:400});checked(await req.db.from('meal_plans').delete().eq('user_id',req.user.id).eq('id',req.params.id));return {ok:true};}));
 router.post('/chat',run(req=>chat(req.db,req.user.id,req.body)));
 router.post('/plans',run(req=>savePlans(req.db,req.user.id,req.body)));
 router.delete('/plans/:id',run(async req=>{if(!uuid(req.params.id))throw Object.assign(new Error('올바른 일정이 아니에요.'),{status:400});checked(await req.db.from('workout_plans').delete().eq('user_id',req.user.id).eq('id',req.params.id));return {ok:true};}));
 return router;
}
