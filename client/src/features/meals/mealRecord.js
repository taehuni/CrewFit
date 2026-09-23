import { queryKeys } from '../../shared/queryKeys.js';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
export const MEAL_PAGE_SIZE = 20;
export const emptyMealItem = () => ({ name: '', amount: '', kcal: '' });

export function validMealId(value) { return /^[1-9]\d*$/.test(String(value)); }
export function validMealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-24') return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function mealPayload(form) {
  const errors = {};
  if (!validMealDate(form.date)) errors.date = '올바른 식사 날짜를 입력해 주세요.';
  if (!MEAL_TYPES.includes(form.type)) errors.type = '끼니 종류를 선택해 주세요.';
  if (!Array.isArray(form.items) || form.items.length < 1 || form.items.length > 30) errors.items = '음식은 1개 이상 30개 이하로 입력해 주세요.';
  const items = (Array.isArray(form.items) ? form.items : []).map((item, index) => {
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const amount = typeof item.amount === 'string' ? item.amount.trim() : '';
    const kcalText = typeof item.kcal === 'string' ? item.kcal.trim() : '';
    if (!name || name.length > 100) errors['name-' + index] = '음식 이름을 1~100자로 입력해 주세요.';
    if (amount.length > 100) errors['amount-' + index] = '양은 100자 이하로 입력해 주세요.';
    if (kcalText && (!/^\d+$/.test(kcalText) || Number(kcalText) > 100000)) errors['kcal-' + index] = '칼로리는 0~100,000 사이의 정수로 입력해 주세요.';
    return { name, amount: amount || null, kcal: kcalText ? Number(kcalText) : null };
  });
  const note = typeof form.note === 'string' ? form.note.trim() : '';
  if (note.length > 1000) errors.note = '메모는 1,000자 이하로 입력해 주세요.';
  return { errors, meal: { eaten_on: form.date, meal_type: form.type, items, note: note || null } };
}

export function mealFormValues(meal) {
  const items = Array.isArray(meal.items) && meal.items.length ? meal.items : [emptyMealItem()];
  return { date: meal.eaten_on, type: MEAL_TYPES.includes(meal.meal_type) ? meal.meal_type : 'breakfast',
    items: items.map(item => ({ name: typeof item?.name === 'string' ? item.name : '', amount: typeof item?.amount === 'string' ? item.amount : '', kcal: Number.isInteger(item?.kcal) && item.kcal >= 0 ? String(item.kcal) : '' })), note: meal.note || '' };
}

function cursorOf(row) {
  if (!validMealId(row.id) || !validMealDate(row.eaten_on)) throw new Error('invalid_meal_cursor');
  return { id: String(row.id), date: row.eaten_on };
}
function before(row, cursor) { return row.eaten_on < cursor.date || (row.eaten_on === cursor.date && BigInt(row.id) < BigInt(cursor.id)); }

export async function loadMealPage(db, userId, cursor = null, signal) {
  if (!userId) throw new Error('invalid_user');
  if (cursor) cursorOf({ id: cursor.id, eaten_on: cursor.date });
  const rows = [];
  let after = cursor;
  while (rows.length < MEAL_PAGE_SIZE + 1) {
    let query = db.from('meals').select('id,eaten_on,meal_type,items,note').eq('user_id', userId)
      .order('eaten_on', { ascending: false }).order('id', { ascending: false }).limit(MEAL_PAGE_SIZE + 1 - rows.length);
    if (after) query = query.or('eaten_on.lt.' + after.date + ',and(eaten_on.eq.' + after.date + ',id.lt.' + after.id + ')');
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('invalid_meal_response');
    if (!data.length) break;
    for (const row of data) {
      const next = cursorOf(row);
      if (after && !before(row, after)) throw new Error('invalid_meal_order');
      rows.push(row); after = next;
    }
  }
  const items = rows.slice(0, MEAL_PAGE_SIZE);
  return { items, nextCursor: rows.length > MEAL_PAGE_SIZE ? cursorOf(items.at(-1)) : undefined };
}

function notFound() { return Object.assign(new Error('식단 기록을 찾을 수 없어요.'), { code: 'not_found' }); }
export async function loadMealDetail(db, userId, id) {
  if (!validMealId(id)) return null;
  const { data, error } = await db.from('meals').select('id,eaten_on,meal_type,items,note')
    .eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data || null;
}
export async function createMeal(db, userId, meal) {
  const { data, error } = await db.from('meals').insert({ ...meal, user_id: userId }).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('식단 저장 결과를 확인하지 못했어요.');
  return data.id;
}
export async function updateMeal(db, userId, id, meal) {
  if (!validMealId(id)) throw notFound();
  const { data, error } = await db.from('meals').update(meal).eq('id', id).eq('user_id', userId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
}
export async function deleteMeal(db, userId, id) {
  if (!validMealId(id)) throw notFound();
  const { data, error } = await db.from('meals').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
}
export async function invalidateMeals(cache, userId) {
  await cache.invalidateQueries({ queryKey: queryKeys.mealsRoot(userId) });
}

export function visibleMealItems(items) {
  return Array.isArray(items) ? items.filter(item => item && typeof item.name === 'string' && item.name.trim()).map(item => ({
    name: item.name.trim(), amount: typeof item.amount === 'string' && item.amount.trim() ? item.amount.trim() : null,
    kcal: Number.isInteger(item.kcal) && item.kcal >= 0 ? item.kcal : null,
  })) : [];
}
