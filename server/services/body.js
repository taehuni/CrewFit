const FIELDS='id,user_id,measured_on,weight_kg,skeletal_muscle_kg,body_fat_percent,note,source_label,created_at';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const isUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function checkId(id){if(!isUuid(id))throw fail(400,'올바른 체성분 기록이 아니에요.');}
function checked(result){if(result.error)throw fail(502,'체성분 기록을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');return result.data;}
function number(value,min,max,label,optional=false){
 if(optional&&(value===null||value===undefined))return null;
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||Math.abs(value*100-Math.round(value*100))>1e-7)throw fail(400,label+' 값을 확인해 주세요. 소수 둘째 자리까지 입력할 수 있어요.');
 return value;
}
export function validateBody(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'측정값을 입력해 주세요.');
 const day=input.measured_on,date=new Date(day+'T00:00:00Z');
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day||day<'2000-01-01'||day>'2100-12-31')throw fail(400,'측정일을 확인해 주세요.');
 const weight=number(input.weight_kg,1,500,'체중'),muscle=number(input.skeletal_muscle_kg,0,500,'골격근량',true),fat=number(input.body_fat_percent,0,100,'체지방률',true);
 if(muscle!==null&&muscle>weight)throw fail(400,'골격근량은 체중보다 클 수 없어요.');
 const note=input.note??'',source=input.source_label??'';
 if(typeof note!=='string'||note.length>500||typeof source!=='string'||source.length>60)throw fail(400,'메모는 500자, 측정 출처는 60자 이내로 입력해 주세요.');
 return {measured_on:day,weight_kg:weight,skeletal_muscle_kg:muscle,body_fat_percent:fat,note:note.trim(),source_label:source.trim()};
}
async function find(db,userId,id){return checked(await db.from('body_measurements').select(FIELDS).eq('user_id',userId).eq('id',id).maybeSingle());}
export async function listBody(db,userId){
 const rows=checked(await db.from('body_measurements').select(FIELDS).eq('user_id',userId).order('measured_on',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(101));
 return {rows:rows.slice(0,100),hasMore:rows.length>100};
}
export async function createBody(db,userId,input){
 checkId(input?.id);const values=validateBody(input);
 const result=await db.from('body_measurements').insert({...values,id:input.id,user_id:userId}).select(FIELDS).single();
 if(result.error?.code==='23505'){
  const existing=await find(db,userId,input.id);
  if(existing&&Object.entries(values).every(([key,value])=>existing[key]===value))return existing;
  throw fail(409,'같은 요청의 기록이 이미 있어요. 목록을 확인한 뒤 새 기록으로 다시 저장해 주세요.');
 }
 return checked(result);
}
export async function updateBody(db,userId,id,input){
 checkId(id);const values=validateBody(input);
 const row=checked(await db.from('body_measurements').update(values).eq('user_id',userId).eq('id',id).select(FIELDS).maybeSingle());
 if(!row)throw fail(404,'기록을 찾을 수 없어요. 목록을 다시 확인해 주세요.');return row;
}
export async function deleteBody(db,userId,id){
 checkId(id);const row=checked(await db.from('body_measurements').delete().eq('user_id',userId).eq('id',id).select('id').maybeSingle());
 if(!row)throw fail(404,'기록을 찾을 수 없어요. 이미 삭제되었는지 확인해 주세요.');return {ok:true};
}
