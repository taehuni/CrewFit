import {useNavigate,useSearchParams,Link} from 'react-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {supabase} from '../../shared/supabaseClient.js';
import {createMeal,invalidateMeals,mealFormValues} from './mealRecord.js';
import MealForm from './MealForm.jsx';
export default function MealCreatePage(){
 const {user}=useAuth(),cache=useQueryClient(),navigate=useNavigate(),[params]=useSearchParams();const planId=params.get('plan');
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const plan=useQuery({queryKey:['meal-plan-record',user.id,planId],enabled:!!planId,retry:false,queryFn:async()=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId))throw Error('식단 계획 주소를 확인해 주세요.');
  const recorded=await supabase.from('meals').select('id').eq('user_id',user.id).eq('source_meal_plan_id',planId).maybeSingle();if(recorded.error)throw recorded.error;if(recorded.data)return {recorded:recorded.data.id};
  const result=await supabase.from('meal_plans').select('*').eq('user_id',user.id).eq('id',planId).maybeSingle();if(result.error)throw result.error;if(!result.data)throw Error('식단 계획이 삭제되었거나 접근할 수 없어요.');return result.data;
 }});
 async function save(meal){const id=await createMeal(supabase,user.id,{...meal,...(planId?{source_meal_plan_id:planId}:{})});await invalidateMeals(cache,user.id);await cache.invalidateQueries({queryKey:['meal-plan-record',user.id,planId]});navigate('/meals/'+id,{replace:true});}
 if(planId){if(plan.isPending)return <p role="status">저장한 식단을 불러오는 중…</p>;if(plan.isError)return <div role="alert"><p>{plan.error.message}</p><Link to="/coach">코치로 돌아가기</Link></div>;if(plan.data.recorded)return <div className="card"><h1>이미 기록한 식단이에요</h1><Link to={'/meals/'+plan.data.recorded}>식단 기록 확인·수정하기</Link></div>;}
 const initial=planId?mealFormValues({eaten_on:today,meal_type:plan.data.meal_type,items:plan.data.items,note:'AI 식단 계획: '+plan.data.title}):undefined;
 return <>{planId&&<p className="card">저장한 계획을 불러왔어요. 실제로 먹은 날짜·음식·양을 확인해 주세요. 칼로리는 비워 두었어요.</p>}<MealForm key={planId||'new'} today={today} initialValues={initial} onSave={save}/></>;
}
