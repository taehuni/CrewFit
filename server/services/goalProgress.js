import { weekRange } from './dashboard.js';

export function goalRanges(now = new Date()) {
  const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  const week = weekRange(today);
  const end = new Date(today + 'T00:00:00Z');
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return { week: { from: week.from, to: week.to }, month: { from: today.slice(0, 7) + '-01', to: end.toISOString().slice(0, 10) } };
}

// Cursor traversal must continue until empty, even if the deployment caps rows below 500.
async function eachPage(makeQuery, consume) {
  let cursor = null;
  for (;;) {
    let query = makeQuery().order('id', { ascending: true }).limit(500);
    if (cursor != null) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('invalid_goal_response');
    if (!data.length) return;
    const next = data.at(-1).id;
    if (cursor != null && BigInt(next) <= BigInt(cursor)) throw new Error('invalid_goal_cursor');
    consume(data);
    cursor = next;
  }
}

export function goalValue(goal, rows) {
  return rows.reduce((sum, row) => {
    if (goal.sport && goal.sport !== row.sport) return sum;
    return sum + (goal.type === 'count' ? 1 : goal.type === 'distance' ? row.distance_m ?? 0 : row.duration_sec ?? 0);
  }, 0);
}

export async function loadGoalProgress(db, userId, now = new Date()) {
  const goals = [];
  await eachPage(() => db.from('goals').select('id,type,sport,target,period,is_active')
    .eq('user_id', userId).eq('is_active', true), rows => goals.push(...rows));
  if (!goals.length) return [];
  const ranges = goalRanges(now);
  const results = goals.map(goal => {
    const target = Number(goal.target);
    if (!Number.isFinite(target) || target <= 0 || !ranges[goal.period]
      || !['count', 'distance', 'duration'].includes(goal.type)) throw new Error('invalid_goal');
    return { ...goal, target, ...ranges[goal.period], current: 0 };
  });
  // Week and month goals are current-period goals, independent of the home week selector.
  for (const period of new Set(results.map(goal => goal.period))) {
    const range = ranges[period];
    const selected = results.filter(goal => goal.period === period);
    await eachPage(() => db.from('activities').select('id,sport,distance_m,duration_sec')
      .eq('user_id', userId).gte('performed_on', range.from).lte('performed_on', range.to), rows => {
      for (const goal of selected) goal.current += goalValue(goal, rows);
    });
  }
  return results.map(goal => ({ ...goal, progress: goal.current / goal.target }));
}
