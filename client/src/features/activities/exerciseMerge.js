import { validActivityId } from './activityDetail.js';

export async function loadExerciseCatalog(db, userId, signal) {
  if (!userId) throw new Error('missing_user');
  const groups = new Map();
  let cursor = null;
  for (;;) {
    let query = db.from('exercise_sets').select('id,activity_id,exercise_name')
      .eq('user_id', userId).order('id', { ascending: false }).limit(500);
    if (cursor != null) query = query.lt('id', cursor);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('invalid_exercise_catalog');
    if (!data.length) break;
    for (const row of data) {
      const id = String(row.id), activityId = String(row.activity_id);
      if (!validActivityId(id) || !validActivityId(activityId) || (cursor != null && BigInt(id) >= BigInt(cursor))
        || typeof row.exercise_name !== 'string' || !row.exercise_name.trim()) throw new Error('invalid_exercise_catalog');
      cursor = id;
      const name = row.exercise_name.trim(), key = name.toLowerCase();
      if (!groups.has(key)) groups.set(key, { name, setCount: 0, activities: new Set() });
      const group = groups.get(key);
      group.setCount++;
      group.activities.add(activityId);
    }
  }
  return [...groups.values()].map(({ name, setCount, activities }) => ({ name, setCount, activityCount: activities.size }));
}

export function exerciseMergePreview(catalog, from, to) {
  const source = catalog.find(item => item.name.toLowerCase() === from.trim().toLowerCase());
  if (!source) throw new Error('정리할 기존 이름을 선택해 주세요.');
  const target = to.trim();
  if (!target || target.length > 100 || source.name.length > 100) throw new Error('운동 이름을 1~100자로 입력해 주세요.');
  if (source.name.toLowerCase() === target.toLowerCase()) throw new Error('기존 이름과 다른 이름을 입력해 주세요.');
  return { from: source.name, to: target, activityCount: source.activityCount, setCount: source.setCount };
}
