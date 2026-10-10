const fail=(status,message)=>Object.assign(new Error(message),{status});
const text=(s,max,required=false)=>typeof s==='string'&&s.length<=max&&(!required||s.trim().length>0);
export const mealPlanSchema={type:'object',additionalProperties:false,required:['title','scheduled_on','meal_type','items','note'],properties:{title:{type:'string'},scheduled_on:{type:'string'},meal_type:{type:'string',enum:['breakfast','lunch','dinner','snack']},items:{type:'array',items:{type:'object',additionalProperties:false,required:['name','amount','alternative'],properties:{name:{type:'string'},amount:{type:'string'},alternative:{type:'string'}}}},note:{type:'string'}}};
export function validateMealPlan(p){
 const date=typeof p?.scheduled_on==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.scheduled_on)?new Date(p.scheduled_on+'T00:00:00Z'):null;
 if(!p||!text(p.title,100,true)||!date||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==p.scheduled_on||p.scheduled_on<'2000-01-01'||p.scheduled_on>'2100-12-31'||!['breakfast','lunch','dinner','snack'].includes(p.meal_type)||!text(p.note,1000)||!Array.isArray(p.items)||p.items.length<1||p.items.length>10||p.items.some(i=>!i||!text(i.name,100,true)||!text(i.amount,100)||!text(i.alternative,200)))throw fail(400,'식단의 날짜·끼니·음식을 확인해 주세요.');
 return {title:p.title.trim(),scheduled_on:p.scheduled_on,meal_type:p.meal_type,items:p.items.map(i=>({name:i.name.trim(),amount:i.amount,alternative:i.alternative})),note:p.note};
}
export function validateNutrition(p){
 if(!p||!['balanced','fitness','muscle','weight'].includes(p.goal)||!['allergies','avoid','preference'].every(k=>text(p[k],300)))throw fail(400,'식사 선호는 항목마다 300자 이하로 입력해 주세요.');
 return {goal:p.goal,allergies:p.allergies.trim(),avoid:p.avoid.trim(),preference:p.preference.trim()};
}
const checked=r=>{if(r.error)throw fail(503,'식단 코치 저장 공간을 확인해 주세요.');return r.data;};
export async function saveMealPlan(db,userId,input){
 if(!/^[0-9a-f-]{36}$/i.test(input?.turn_id||'')||!Number.isInteger(input?.position)||input.position<0||input.position>6)throw fail(400,'저장할 식단을 선택해 주세요.');
 const turn=checked(await db.from('coach_turns').select('meal_proposals').eq('user_id',userId).eq('id',input.turn_id).maybeSingle());
 if(!turn?.meal_proposals?.[input.position])throw fail(404,'식단 제안을 찾을 수 없어요.');
 const plan=validateMealPlan(turn.meal_proposals[input.position]);
 checked(await db.from('meal_plans').upsert({...plan,user_id:userId,turn_id:input.turn_id,position:input.position},{onConflict:'user_id,turn_id,position',ignoreDuplicates:true}));
 return checked(await db.from('meal_plans').select('*').eq('user_id',userId).eq('turn_id',input.turn_id).eq('position',input.position).single());
}
