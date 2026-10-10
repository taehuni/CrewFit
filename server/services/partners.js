import {supabaseAdmin} from '../config/supabase.js';
import {findOffer} from './partnerCatalog.js';
import {uuid} from './coach.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const checked=r=>{if(r.error)throw fail(503,'예약 저장 공간에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');return r.data;};
export function reservationInput(input,now=Date.now()){
 const found=findOffer(input?.offerId);if(!uuid(input?.id)||!found||typeof input.visitOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.visitOn))throw fail(400,'상품과 방문 날짜를 확인해 주세요.');
 const date=new Date(input.visitOn+'T00:00:00Z'),today=new Date(now+9*3600000).toISOString().slice(0,10),end=new Date(now+9*3600000+90*86400000).toISOString().slice(0,10);
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==input.visitOn||input.visitOn<today||input.visitOn>end)throw fail(400,'방문 날짜는 오늘부터 90일 이내로 선택해 주세요.');
 return {id:input.id,offer_id:found.offer.id,facility_name:found.facility.name,offer_name:found.offer.name,amount:found.offer.amount,visit_on:input.visitOn};
}
export async function createReservation(userId,input,{db=supabaseAdmin,now=Date.now()}={}){
 const data=reservationInput(input,now);
 const existing=checked(await db.from('partner_reservations').select('*').eq('id',data.id).maybeSingle());
 if(existing){if(existing.user_id!==userId||existing.offer_id!==data.offer_id||existing.visit_on!==data.visit_on)throw fail(409,'새 예약 요청으로 다시 시도해 주세요.');return existing;}
 const result=await db.from('partner_reservations').insert({...data,user_id:userId}).select('*').single();
 if(result.error?.code==='23505')return createReservation(userId,input,{db,now});return checked(result);
}
export async function changeReservation(userId,id,action,{db=supabaseAdmin,now=Date.now()}={}){
 if(!uuid(id)||!['simulate','cancel'].includes(action))throw fail(400,'올바른 예약 요청이 아니에요.');
 const record=checked(await db.from('partner_reservations').select('*').eq('id',id).eq('user_id',userId).maybeSingle());if(!record)throw fail(404,'예약을 찾을 수 없어요.');
 if(action==='simulate'&&record.status==='cancelled')throw fail(409,'취소한 예약은 결제할 수 없어요.');
 const patch=action==='simulate'?{status:'test_paid',paid_at:new Date(now).toISOString()}:{status:'cancelled',cancelled_at:new Date(now).toISOString()};
 if(record.status===patch.status)return record;
 const updated=checked(await db.from('partner_reservations').update(patch).eq('id',id).eq('user_id',userId).eq('status',record.status).select('*').maybeSingle());
 if(!updated)throw fail(409,'예약 상태가 변경됐어요. 새로고침 후 확인해 주세요.');return updated;
}
