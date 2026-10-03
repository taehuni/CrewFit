import { trackingPayload, TRACKING_SPORTS } from './tracking.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isDraftId = value => typeof value === 'string' && UUID.test(value);
export function draftError(error) {
  return ['PGRST202','PGRST205','42P01'].includes(error?.code)
    ? 'GPS 보관 기능을 준비 중이에요. 관리자에게 DB 업데이트를 요청해 주세요. 측정 내용은 유지됩니다.'
    : 'GPS 보관 결과를 확인하지 못했어요. 내용을 유지했으니 다시 시도해 주세요.';
}
export async function saveGpsDraft(db, id, sport, track, note) {
  if (!isDraftId(id)) throw new Error('측정 식별자를 확인해 주세요.');
  const p = trackingPayload(sport, track, note);
  const { data, error } = await db.rpc('save_gps_draft', {
    p_id:id,p_sport:p.p_sport,p_started_at:p.p_started_at,p_duration_sec:p.p_duration_sec,
    p_distance_m:p.p_distance_m,p_note:p.p_note,p_points:p.p_points,
  });
  if (error || data !== id) throw new Error(draftError(error));
  return data;
}
export async function listGpsDrafts(db, userId, { date, sport } = {}, signal) {
  if (!userId || (sport && !TRACKING_SPORTS.includes(sport))) return [];
  let query = db.from('gps_drafts').select('id,sport,performed_on,started_at,duration_sec,distance_m,note')
    .eq('user_id',userId).is('finalized_at',null);
  if (date) query = query.eq('performed_on',date);
  if (sport) query = query.eq('sport',sport);
  query = query.order('started_at',{ascending:false}).limit(50);
  if (signal) query = query.abortSignal(signal);
  const {data,error} = await query;
  if (error) throw error;
  return data || [];
}
export async function loadGpsDraft(db, userId, id, signal) {
  if (!userId || !isDraftId(id)) return null;
  let query = db.from('gps_drafts').select('id,sport,performed_on,started_at,duration_sec,distance_m,note,points,finalized_at,activity_id')
    .eq('user_id',userId).eq('id',id);
  if (signal) query = query.abortSignal(signal);
  const {data,error} = await query.maybeSingle();
  if (error) throw error;
  return data;
}
export async function finalizeGpsDraft(db, id, note) {
  if (!isDraftId(id) || typeof note !== 'string' || note.length > 1000) throw new Error('불러온 측정과 메모를 확인해 주세요.');
  const {data,error} = await db.rpc('finalize_gps_draft',{p_id:id,p_note:note.trim() || null});
  if (error || !/^[1-9]\d*$/.test(String(data))) throw new Error(error?.code === 'P0002' ? '보관한 측정 또는 원래 기록이 삭제되었어요. 목록에서 다시 확인해 주세요.' : draftError(error));
  return String(data);
}
