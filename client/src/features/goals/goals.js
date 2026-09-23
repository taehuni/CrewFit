import { queryKeys } from '../../shared/queryKeys.js';

export const GOAL_SPORTS = ['running', 'walking', 'cycling', 'swimming', 'gym', 'other'];
export const GOAL_TYPES = { count: '운동 횟수', distance: '운동 거리', duration: '운동 시간' };
export const GOAL_PERIODS = { week: '매주', month: '매월' };
export const emptyGoal = () => ({ type: 'count', sport: '', period: 'week', target: '', is_active: true });
export const goalFactor = goal => goal.type === 'duration' ? 60 : goal.type === 'distance' ? 1000 : 1;
export const goalUnit = goal => goal.type === 'duration' ? '분' : goal.type === 'distance' ? 'km' : '회';
export const goalNumber = (value, goal) => (Number(value) / goalFactor(goal)).toLocaleString('ko-KR', { maximumFractionDigits: 3 });
export const goalForm = goal => ({ type: goal.type, sport: goal.sport || '', period: goal.period,
  target: String(Number(goal.target) / goalFactor(goal)), is_active: goal.is_active });

export function goalPayload(form) {
  if (!Object.hasOwn(GOAL_TYPES, form.type) || !Object.hasOwn(GOAL_PERIODS, form.period)
    || (form.sport !== '' && !GOAL_SPORTS.includes(form.sport))) throw new Error('목표 종류·종목·기간을 확인해 주세요.');
  const raw = String(form.target).trim();
  const target = Number(raw) * goalFactor(form);
  if (!/^\d+(\.\d+)?$/.test(raw) || !Number.isFinite(target) || target <= 0 || target > Number.MAX_SAFE_INTEGER)
    throw new Error('목표 값을 0보다 큰 숫자로 입력해 주세요.');
  if (form.type === 'count' && !Number.isInteger(target)) throw new Error('운동 횟수는 정수로 입력해 주세요.');
  return { type: form.type, sport: form.sport || null, period: form.period, target, is_active: form.is_active !== false };
}

function validId(id) { return /^[1-9]\d*$/.test(String(id)); }
function missingGoal() { return new Error('목표를 찾을 수 없어요. 목록을 다시 불러와 주세요.'); }

export async function loadGoals(db, userId, signal) {
  const rows = [];
  let cursor = null;
  for (;;) {
    let query = db.from('goals').select('id,type,sport,target,period,is_active').eq('user_id', userId)
      .order('id', { ascending: true }).limit(500);
    if (cursor != null) query = query.gt('id', cursor);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('목표 목록을 확인하지 못했어요.');
    if (!data.length) return rows;
    const next = data.at(-1).id;
    if (cursor != null && BigInt(next) <= BigInt(cursor)) throw new Error('목표 목록을 확인하지 못했어요.');
    rows.push(...data);
    cursor = next;
  }
}

export async function saveGoal(db, userId, form, id = null) {
  const payload = goalPayload(form);
  if (id != null && !validId(id)) throw missingGoal();
  const query = id == null ? db.from('goals').insert({ ...payload, user_id: userId })
    : db.from('goals').update(payload).eq('id', id).eq('user_id', userId);
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw missingGoal();
}

export async function changeGoal(db, userId, id, active) {
  if (!validId(id)) throw missingGoal();
  const table = db.from('goals');
  const query = active == null ? table.delete() : table.update({ is_active: Boolean(active) });
  const { data, error } = await query.eq('id', id).eq('user_id', userId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw missingGoal();
}

export async function invalidateGoals(cache, userId) {
  await Promise.all([
    cache.invalidateQueries({ queryKey: queryKeys.goals(userId) }),
    cache.invalidateQueries({ queryKey: queryKeys.dashboardRoot(userId) }),
  ]);
}
