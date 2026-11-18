import {checked,uuid,validatePlan} from './coach.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export async function coachWorkspace(db,userId,{turn_id}={}){
 if(turn_id!==undefined&&!uuid(turn_id))throw fail(400,'올바른 대화가 아니에요.');
 const turns=checked(await db.from('coach_turns').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(30));
 const turnIds=[...new Set([...turns.map(turn=>turn.id),...(turn_id?[turn_id]:[])])];
 // Each turn has at most 28 proposals. Include the selected older conversation
 // so refetching after an edit cannot make its saved proposals look unsaved.
 const plans=turnIds.length?checked(await db.from('workout_plans').select('*').eq('user_id',userId).in('turn_id',turnIds).order('id').limit(31*28)):[];
 return {turns:turns.reverse(),plans};
}
export function planMonthRange(month){
 if(typeof month!=='string'||! /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month))throw fail(400,'조회할 연월을 확인해 주세요.');
 const last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
 return {from:month+'-01',to:month+'-'+last};
}
export async function listWorkoutPlans(db,userId,{month,cursor}={}){
 const {from,to}=planMonthRange(month);
 if(cursor!==undefined&&!uuid(cursor))throw fail(400,'계획 조회 위치를 확인해 주세요.');
 let query=db.from('workout_plans').select('*').eq('user_id',userId).gte('scheduled_on',from).lte('scheduled_on',to).order('id',{ascending:true}).limit(101);
 if(cursor)query=query.gt('id',cursor);
 const rows=checked(await query),page=rows.slice(0,100);
 const links=page.length?await db.from('workout_plan_records').select('plan_id,activity_id').eq('user_id',userId).in('plan_id',page.map(plan=>plan.id)): {data:[]};
 // Missing migration must not hide existing plans, but never imply completion data is loaded.
 const available=!links.error;
 const records=new Map((links.data||[]).map(row=>[row.plan_id,row.activity_id]));
 return {plans:page.map(plan=>({...plan,activity_id:records.get(plan.id)||null,completion_available:available})),nextCursor:rows.length>100?rows[99].id:null};
}
export async function createWorkoutPlan(db,userId,input){
 if(!uuid(input?.id))throw fail(400,'저장 요청을 다시 확인해 주세요.');
 const row={...validatePlan(input),id:input.id,user_id:userId,turn_id:null,position:null};
 const result=await db.from('workout_plans').upsert(row,{onConflict:'id',ignoreDuplicates:true}).select('*').maybeSingle();
 if(result.error)throw fail(503,'직접 계획을 저장하지 못했어요. 잠시 후 다시 시도해 주세요. 입력한 내용은 유지돼요.');
 if(result.data)return result.data;
 const existing=checked(await db.from('workout_plans').select('*').eq('user_id',userId).eq('id',input.id).maybeSingle());
 if(!existing)throw fail(404,'저장한 계획을 확인하지 못했어요. 다시 불러와 주세요.');
 const same=Object.keys(validatePlan(input)).every(key=>key==='start_time'?String(existing[key]).slice(0,5)===row[key]:existing[key]===row[key]);
 if(!same)throw fail(409,'이 계획은 이미 저장됐어요. 달력에서 저장한 계획을 확인한 뒤 수정해 주세요. 입력한 내용은 유지돼요.');
 return existing;
}
export async function listMealPlans(db,userId,{month,cursor}={}){
 const {from,to}=planMonthRange(month);
 if(cursor!==undefined&&!uuid(cursor))throw fail(400,'식단 조회 위치를 확인해 주세요.');
 let query=db.from('meal_plans').select('*').eq('user_id',userId).gte('scheduled_on',from).lte('scheduled_on',to).order('id',{ascending:true}).limit(101);
 if(cursor)query=query.gt('id',cursor);
 const rows=checked(await query);
 return {plans:rows.slice(0,100),nextCursor:rows.length>100?rows[99].id:null};
}
export async function updateWorkoutPlan(db,userId,id,input){
 if(!uuid(id))throw fail(400,'올바른 일정이 아니에요.');
 const changes=validatePlan(input);
 const result=await db.from('workout_plans').update(changes).eq('user_id',userId).eq('id',id).select('*').maybeSingle();
 if(result.error?.code==='42501')throw fail(503,'계획 수정 권한 설정이 필요해요. 관리자에게 알려 주세요. 입력한 내용은 유지돼요.');
 const plan=checked(result);
 if(!plan)throw fail(404,'수정할 계획을 찾을 수 없어요. 삭제되었거나 접근할 수 없는 계획이에요.');
 return plan;
}
