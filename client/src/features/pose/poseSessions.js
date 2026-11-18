const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import {GYM_EXERCISE_CRITERIA} from '../../../../shared/gymCriteria.js';
const CATALOGUE=new Map(GYM_EXERCISE_CRITERIA.filter(row=>row.evaluationStatus==='reference-only').map(row=>[row.id,row]));
const VIEWS={squat:['side','front'],lunge:['left','right'],pushup:['side']};
const KEYS=['heel','torso','leftKnee','rightKnee','bodyLine'];
const FIELDS=['id','measured_on','exercise','exercise_label','view','reps','duration_seconds','observations'];
const SELECT='id,measured_on,exercise,exercise_label,view,reps,duration_seconds,observations,created_at';
const LEGACY_SELECT=SELECT.replace('exercise_label,','');
const missingLabel=error=>['42703','PGRST204'].includes(error?.code)&&`${error?.message||''} ${error?.details||''}`.includes('exercise_label');
const setupRequired=()=>Object.assign(new Error('새 운동 기록 저장 설정이 아직 준비되지 않았어요. 기존 기록은 계속 볼 수 있으며, 현재 결과는 이 화면에 남아 있어요.'),{code:'pose_setup_required',status:503});
export const poseToday=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const fail=()=>{throw new Error('자세 기록의 날짜와 측정 내용을 확인해 주세요.');};

// Deliberately pick only small human-readable summaries, never frame data.
export function normalizePoseObservations(items=[],exercise=null){
 if(!Array.isArray(items)||items.length>5)fail();
 const seen=new Set();
 return items.map(item=>{
  const reference=CATALOGUE.get(exercise);
  const validKey=reference?reference.observable.some((_,index)=>item?.key===`criterion_${index}`)&&item?.source_id===exercise:KEYS.includes(item?.key);
  if(!item||!validKey||seen.has(item.key)||typeof item.label!=='string'||!item.label.trim()||item.label.length>60||typeof item.message!=='string'||!item.message.trim()||item.message.length>500)fail();
  seen.add(item.key);
  return {key:item.key,label:item.label.trim(),message:item.message.trim(),...(reference?{source_id:exercise}:{})};
 });
}

export function buildPoseSession(input){
 if(!input||Object.keys(input).some(key=>!FIELDS.includes(key)))fail();
 const {id,measured_on,exercise,view,reps,duration_seconds}=input;
 if(!UUID.test(id)||typeof measured_on!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(measured_on)||measured_on<'2000-01-01'||measured_on>'2100-12-31')fail();
 const date=new Date(measured_on+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==measured_on)fail();
 const legacy=Object.hasOwn(VIEWS,exercise),reference=CATALOGUE.has(exercise),manual=exercise==='manual_other';
 if(legacy?!VIEWS[exercise].includes(view):reference?view!=='auto':manual?view!=='manual':true)fail();
 if(!legacy||view==='front'?reps!==null:!Number.isInteger(reps)||reps<0||reps>10000)fail();
 const exerciseLabel=typeof input.exercise_label==='string'?input.exercise_label.trim():null;
 if(manual?(!exerciseLabel||exerciseLabel.length>60||/[\u0000-\u001f\u007f]/.test(exerciseLabel)):input.exercise_label!=null)fail();
 if(!Number.isInteger(duration_seconds)||duration_seconds<1||duration_seconds>86400)fail();
 const observations=normalizePoseObservations(input.observations??[],reference?exercise:null);
 const allowed=view==='front'?['leftKnee','rightKnee']:exercise==='pushup'?['bodyLine']:['heel','torso'];
 if(legacy&&observations.some(item=>!allowed.includes(item.key))||manual&&observations.length)fail();
 return {id,measured_on,exercise,view,reps,duration_seconds,observations,...(manual?{exercise_label:exerciseLabel}:reference?{exercise_label:null}:{})};
}

async function connection(client){return client||(await import('../../shared/supabaseClient.js')).supabase;}
async function currentUser(client){
 const {data,error}=await client.auth.getUser();
 if(error||!data?.user?.id)throw new Error('로그인 후 자세 기록을 이용해 주세요.');
 return data.user.id;
}
export async function savePoseSession(input,{client,expectedUserId}={}){
 const payload=buildPoseSession(input),db=await connection(client),userId=await currentUser(db);
 if(!expectedUserId||userId!==expectedUserId)throw new Error('로그인 계정이 바뀌었어요. 다시 측정해 주세요.');
 let {data,error}=await db.from('pose_sessions').insert({...payload,user_id:userId}).select(SELECT).single();
 if(missingLabel(error)){
  if(!Object.hasOwn(VIEWS,payload.exercise))throw setupRequired();
  ({data,error}=await db.from('pose_sessions').insert({...payload,user_id:userId}).select(LEGACY_SELECT).single());
 }
 if(!error)return data;
 if(error.code!=='23505')throw error;
 // A lost response can be retried with the same ID, without changing history.
 let existing=await db.from('pose_sessions').select(SELECT).eq('user_id',userId).eq('id',payload.id).single();
 if(missingLabel(existing.error))existing=await db.from('pose_sessions').select(LEGACY_SELECT).eq('user_id',userId).eq('id',payload.id).single();
 if(existing.error)throw existing.error;
 const comparison=(row,field)=>field==='observations'?(row?.observations??[]).map(item=>[item.key,item.label,item.message,item.source_id??null]):row?.[field]??null;
 const same=FIELDS.every(field=>JSON.stringify(comparison(existing.data,field))===JSON.stringify(comparison(payload,field)));
 if(!same)throw Object.assign(new Error('이 측정은 다른 내용으로 이미 저장되어 있어요. 지난 기록을 확인해 주세요. 현재 결과는 유지됩니다.'),{code:'pose_conflict',status:409});
 return existing.data;
}
export async function listPoseSessions({client,limit=20,expectedUserId}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)fail();
 const db=await connection(client),userId=await currentUser(db);
 if(expectedUserId!==undefined&&userId!==expectedUserId)throw new Error('로그인 계정이 바뀌었어요. 기록을 다시 불러와 주세요.');
 const read=fields=>db.from('pose_sessions').select(fields).eq('user_id',userId).order('measured_on',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit);
 let {data,error}=await read(SELECT);
 if(missingLabel(error))({data,error}=await read(LEGACY_SELECT));
 if(error)throw error;
 return data??[];
}
