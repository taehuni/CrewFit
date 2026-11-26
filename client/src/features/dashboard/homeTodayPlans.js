export async function loadHomeTodayPlans(db, userId, today) {
  const { data, count, error } = await db.from('workout_plans')
    .select('id,title,sport,start_time,minutes', { count: 'exact' })
    .eq('user_id', userId).eq('scheduled_on', today)
    .order('start_time', { ascending: true }).order('id', { ascending: true }).limit(2);
  if (error) throw error;
  const plans = data || [];
  if (!plans.length) return { plans, count: count ?? 0 };

  let links;
  try {
    links = await db.from('workout_plan_records').select('plan_id,activity_id')
      .eq('user_id', userId).in('plan_id', plans.map(plan => plan.id));
  } catch {
    links = { error: true };
  }
  const completed = new Map((links.error ? [] : links.data || []).map(row => [row.plan_id, row.activity_id]));
  return { count: count ?? plans.length, plans: plans.map(plan => ({ ...plan,
    activity_id: completed.get(plan.id) ?? null, completion_available: !links.error,
  })) };
}
