const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function sourceWorkoutPlanId(state,userId){return userId&&state?.planOwnerId===userId&&uuid(state?.workoutPlan?.id)?state.workoutPlan.id:null;}
export async function recordWorkoutPlan(db,planId,payload,gpsDraftId){
 const {data,error}=await db.rpc(gpsDraftId?'record_workout_plan_gps':'record_workout_plan',gpsDraftId?{p_plan_id:planId,p_draft_id:gpsDraftId,p_note:payload.activity.note||null}:{p_plan_id:planId,p_activity:payload.activity,p_sets:payload.sets||[]});
 if(error)throw new Error('계획에 연결한 기록을 저장하지 못했어요. 입력한 내용은 유지돼요. 잠시 후 다시 시도해 주세요.');
 if(data===null||data===undefined)throw new Error('저장 결과를 확인하지 못했어요. 다시 눌러 확인해 주세요.');
 return data;
}
