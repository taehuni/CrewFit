import {checked,uuid} from './coach.js';
const bad=()=>Object.assign(new Error('검색 조건을 확인해 주세요.'),{status:400});
export function historyFilters(params={}) {
 const q=typeof params.q==='string'?params.q.trim():'';
 if(q.length>100)throw bad();
 let start,end;
 if(params.date){
  if(typeof params.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(params.date))throw bad();
  const day=new Date(params.date+'T00:00:00Z');
  if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==params.date)throw bad();
  start=new Date(day.getTime()-9*3600000).toISOString();end=new Date(day.getTime()+15*3600000).toISOString();
 }
 let cursor;
 if(params.cursor){try{cursor=JSON.parse(Buffer.from(params.cursor,'base64url').toString());}catch{throw bad();}
  if(!uuid(cursor.id)||typeof cursor.time!=='string'||!/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.time)||!Number.isFinite(Date.parse(cursor.time)))throw bad();
 }
 return {q,start,end,cursor};
}
export async function coachHistory(db,userId,params={}) {
 const {q,start,end,cursor}=historyFilters(params);
 let query=db.from('coach_turns').select('*').eq('user_id',userId);
 const conditions=[];
 if(q){const pattern=JSON.stringify('%'+q.replace(/[\\%_]/g,'\\$&')+'%');conditions.push(`or(message.ilike.${pattern},answer.ilike.${pattern})`);}
 if(start)query=query.gte('created_at',start).lt('created_at',end);
 if(cursor)conditions.push(`or(created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},id.lt.${cursor.id}))`);
 if(conditions.length)query=query.or(`and(${conditions.join(',')})`);
 const rows=checked(await query.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(16));
 const turns=rows.slice(0,15),last=turns.at(-1);
 const plans=turns.length?checked(await db.from('workout_plans').select('*').eq('user_id',userId).in('turn_id',turns.map(t=>t.id))):[];
 return {turns,plans,nextCursor:rows.length>15?Buffer.from(JSON.stringify({time:last.created_at,id:last.id})).toString('base64url'):null};
}
