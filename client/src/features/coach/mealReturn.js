const uuid = value => typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);
export function mealDate(value, fallback) {
  const date = new Date(value + 'T00:00:00Z');
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$|^2100-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : fallback;
}
export function reviewId(value) { return uuid(value) ? value : null; }
export function mealPosition(value) { return /^[0-6]$/.test(String(value)) ? Number(value) : 0; }
export function proposalMealReturn(turnId, position) {
  if (!uuid(turnId)) return '/coach?view=chat';
  return '/coach?' + new URLSearchParams({ view: 'chat', review: turnId, meal: String(mealPosition(position)) }) + '#meal-proposal-' + turnId;
}
export function savedMealReturn(date, id) {
  return '/meals?' + new URLSearchParams({ view: 'plans', ...(mealDate(date) ? { date } : {}) }) + (uuid(id) ? '#meal-plan-' + id : '');
}
export function safeMealReturn(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/meals?view=plans';
  try {
    const url = new URL(value, 'https://crewfit.invalid');
    if (url.origin !== 'https://crewfit.invalid') return '/meals?view=plans';
    if (url.pathname === '/coach' && uuid(url.searchParams.get('review'))) return proposalMealReturn(url.searchParams.get('review'), url.searchParams.get('meal'));
    if (url.pathname === '/meals') return savedMealReturn(url.searchParams.get('date'), url.hash.slice('#meal-plan-'.length));
  } catch {}
  return '/meals?view=plans';
}
export function ingredientStoreLink(name, returnTo) {
  return '/store?' + new URLSearchParams({ source: 'meal', q: name, meal_return: safeMealReturn(returnTo) });
}
export async function loadReviewTurn(db, owner, id, signal) {
  if (!owner || !uuid(id)) return null;
  const result = await db.from('coach_turns').select('*').eq('user_id', owner).eq('id', id).abortSignal(signal).maybeSingle();
  if (result.error) throw new Error('원래 식단 제안을 불러오지 못했어요. 다시 시도해 주세요.');
  return result.data;
}
