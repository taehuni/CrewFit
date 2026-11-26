const planIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Query only the visible plans, with owner filtering on every page.
export async function loadMealPlanRecords(db, userId, planIds, signal) {
  if (!userId || !Array.isArray(planIds) || planIds.some(id => !planIdPattern.test(id))) throw new Error('식단 계획을 확인해 주세요.');
  const ids = [...new Set(planIds)], records = {};
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    let after = null;
    while (true) {
      let query = db.from('meals').select('id,source_meal_plan_id,eaten_on').eq('user_id', userId)
        .in('source_meal_plan_id', batch).order('id', { ascending: true }).limit(50);
      if (after) query = query.gt('id', after);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('식단 기록 상태를 확인하지 못했어요.');
      if (!data.length) break;
      for (const row of data) {
        if (!/^[1-9]\d*$/.test(String(row.id)) || (after && BigInt(row.id) <= BigInt(after)) || !batch.includes(row.source_meal_plan_id)) throw new Error('식단 기록 상태를 확인하지 못했어요.');
        records[row.source_meal_plan_id] = { id: row.id, eaten_on: row.eaten_on };
        after = String(row.id);
      }
    }
  }
  return records;
}
