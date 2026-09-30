import { validActivityId } from '../activities/activityDetail.js';
const FIELDS='id,sport,performed_on,duration_sec,distance_m';
export async function ownAttachment(db,userId,id) {
  if(!userId || !validActivityId(String(id)))throw new Error('올바른 본인 기록을 선택해 주세요.');
  const {data,error}=await db.from('activities').select(FIELDS).eq('id',id).eq('user_id',userId).maybeSingle();
  if(error || !data)throw new Error('기록이 삭제되었거나 본인 기록이 아니에요. 다시 선택해 주세요.');
  return data;
}
export async function attachmentChoices(db,userId,cursor=null) {
  if(!userId)throw new Error('로그인이 필요해요.');
  let query=db.from('activities').select(FIELDS).eq('user_id',userId).order('id',{ascending:false}).limit(20);
  if(cursor!=null)query=query.lt('id',cursor);
  const {data,error}=await query;
  if(error || !Array.isArray(data))throw new Error('내 운동 기록을 불러오지 못했어요.');
  return {rows:data,next:data.length?data.at(-1).id:undefined};
}
export async function sharedAttachment(db,postId) {
  if(!validActivityId(String(postId)))return null;
  // Authoritative post read first: profile visibility alone must not reveal a detached record here.
  const post=await db.from('posts').select('activity_id').eq('id',postId).maybeSingle();
  if(post.error)throw new Error('첨부 기록을 확인하지 못했어요.');
  if(!post.data?.activity_id)return null;
  const id=post.data.activity_id;
  const {data:activity,error}=await db.from('activities').select(FIELDS).eq('id',id).maybeSingle();
  if(error)throw new Error('첨부 기록을 불러오지 못했어요.');
  if(!activity)return null;
  const sets=[];
  if(activity.sport==='gym'){
    let cursor=null;
    for(;;){
      let query=db.from('exercise_sets').select('id,exercise_name,set_no,reps,weight_kg').eq('activity_id',id).order('id',{ascending:true}).limit(500);
      if(cursor!=null)query=query.gt('id',cursor);
      const result=await query;
      if(result.error || !Array.isArray(result.data))throw new Error('헬스 세트를 불러오지 못했어요.');
      if(!result.data.length)break;
      const next=result.data.at(-1).id;
      if(cursor!=null && BigInt(next)<=BigInt(cursor))throw new Error('헬스 세트를 불러오지 못했어요.');
      sets.push(...result.data);cursor=next;
    }
  }
  return {activity,sets};
}
