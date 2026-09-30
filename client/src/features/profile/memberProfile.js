export const PUBLIC_PROFILE_FIELDS = 'id,nickname,main_sport,level,activity_visibility,show_crews';
export const RECORD_VISIBILITY = { public: '전체 회원', crew: '같은 크루원', private: '나만' };
export function validMemberId(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function requireMember(id) { if (!validMemberId(id)) throw new Error('올바른 회원 주소가 아니에요.'); }
export function profileInput(form) {
  const nickname = typeof form.nickname === 'string' ? form.nickname.trim() : '';
  if (nickname.length < 2 || nickname.length > 20 || /[\u0000-\u001f\u007f]/.test(nickname)) throw new Error('닉네임은 2~20자로 입력해 주세요.');
  if (!Object.hasOwn(RECORD_VISIBILITY, form.activity_visibility) || typeof form.show_crews !== 'boolean') throw new Error('공개 범위를 다시 선택해 주세요.');
  return { nickname, activity_visibility: form.activity_visibility, show_crews: form.show_crews };
}
export async function savePublicProfile(db, userId, form) {
  requireMember(userId);
  const { data, error } = await db.from('profiles').update(profileInput(form)).eq('id', userId).select(PUBLIC_PROFILE_FIELDS).single();
  if (error || !data) throw new Error('프로필을 저장하지 못했어요. 입력을 유지했으니 다시 시도해 주세요.');
  return data;
}
export async function loadMember(db, memberId, signal) {
  requireMember(memberId);
  const { data, error } = await db.from('profiles').select(PUBLIC_PROFILE_FIELDS).eq('id', memberId).abortSignal(signal).maybeSingle();
  if (error) throw error;
  return data;
}
function validCursor(id) { return /^[1-9]\d*$/.test(String(id)); }
export async function loadMemberRecords(db, memberId, cursor = null, signal) {
  requireMember(memberId);
  if (cursor && (!validCursor(cursor.id) || !/^\d{4}-\d{2}-\d{2}$/.test(cursor.date))) throw new Error('기록 목록을 다시 열어 주세요.');
  // RLS also permits records explicitly shared in visible posts. Never select routes or private settings.
  let query = db.from('activities').select('id,sport,performed_on,duration_sec,distance_m').eq('user_id', memberId)
    .order('performed_on', { ascending: false }).order('id', { ascending: false }).limit(21);
  if (cursor) query = query.or(`performed_on.lt.${cursor.date},and(performed_on.eq.${cursor.date},id.lt.${cursor.id})`);
  const { data, error } = await query.abortSignal(signal);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('기록을 불러오지 못했어요.');
  const rows = data.slice(0, 20), last = rows.at(-1);
  return { rows, next: data.length > 20 ? { date: last.performed_on, id: String(last.id) } : undefined };
}
export async function loadMemberCrews(db, memberId, cursor = null, signal) {
  requireMember(memberId);
  if (cursor != null && !validCursor(cursor)) throw new Error('크루 목록을 다시 열어 주세요.');
  // Do not gate on show_crews in the UI: RLS still allows fellow members to see their shared crew.
  let query = db.from('crew_members').select('crew_id,crews(id,name,sport)').eq('user_id', memberId)
    .eq('status', 'approved').order('crew_id', { ascending: true }).limit(21);
  if (cursor != null) query = query.gt('crew_id', cursor);
  const { data, error } = await query.abortSignal(signal);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('크루를 불러오지 못했어요.');
  return { rows: data.slice(0, 20), next: data.length > 20 ? String(data[19].crew_id) : undefined };
}
