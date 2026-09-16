import { validActivityId } from './activityDetail.js';
import { ACTIVITY_SPORTS } from './sports.js';

export const LIST_PAGE_SIZE = 20;
export const LIST_SPORTS = ACTIVITY_SPORTS;
export function validListDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-24') return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function listFilters(search) {
  return { sport: search.get('sport') || '', from: search.get('from') || '', to: search.get('to') || '' };
}
export function filterError({ sport, from, to }) {
  if (sport && !LIST_SPORTS.includes(sport)) return '지원하지 않는 종목입니다. 필터를 다시 선택해 주세요.';
  if ((from && !validListDate(from)) || (to && !validListDate(to))) return '올바른 시작일과 종료일을 입력해 주세요.';
  if (from && to && from > to) return '종료일은 시작일보다 빠를 수 없어요.';
  return '';
}
export function listURL(filters) {
  const search = new URLSearchParams();
  for (const key of ['sport', 'from', 'to']) if (filters[key]) search.set(key, filters[key]);
  return '/activities' + (search.size ? '?' + search.toString() : '');
}
export function activitiesReturnTo(state) {
  const path = state?.activitiesReturnTo;
  if (typeof path !== 'string' || !(path === '/activities' || path.startsWith('/activities?'))) return null;
  const filters = listFilters(new URLSearchParams(path.split('?')[1]));
  return filterError(filters) ? '/activities' : listURL(filters);
}
function rowCursor(row) {
  if (!validActivityId(String(row.id)) || !validListDate(row.performed_on)) throw new Error('invalid_list_cursor');
  return { id: String(row.id), date: row.performed_on };
}
function isBefore(row, cursor) {
  return row.performed_on < cursor.date || (row.performed_on === cursor.date && BigInt(row.id) < BigInt(cursor.id));
}
// D-10: own records under RLS; date + ID cursor handles multiple records on the same day.
export async function loadActivityPage(db, userId, filters, cursor = null, signal) {
  if (!userId || filterError(filters)) throw new Error('invalid_list_filters');
  if (cursor) rowCursor({ id: cursor.id, performed_on: cursor.date });
  const rows = [];
  let after = cursor;
  while (rows.length < LIST_PAGE_SIZE + 1) {
    let query = db.from('activities').select('id,sport,performed_on,duration_sec,distance_m,note')
      .eq('user_id', userId).order('performed_on', { ascending: false }).order('id', { ascending: false })
      .limit(LIST_PAGE_SIZE + 1 - rows.length);
    if (filters.sport) query = query.eq('sport', filters.sport);
    if (filters.from) query = query.gte('performed_on', filters.from);
    if (filters.to) query = query.lte('performed_on', filters.to);
    if (after) query = query.or('performed_on.lt.' + after.date + ',and(performed_on.eq.' + after.date + ',id.lt.' + after.id + ')');
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('invalid_list_response');
    if (!data.length) break;
    for (const row of data) {
      const next = rowCursor(row);
      if (after && !isBefore(row, after)) throw new Error('invalid_list_order');
      rows.push(row);
      after = next;
    }
  }
  const items = rows.slice(0, LIST_PAGE_SIZE);
  return { items, nextCursor: rows.length > LIST_PAGE_SIZE ? rowCursor(items.at(-1)) : undefined };
}
