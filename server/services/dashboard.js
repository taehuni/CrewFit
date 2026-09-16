const DAY = 86400000;

export function weekRange(value, now = new Date()) {
  const date = value ?? new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid_date');
  const anchor = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(anchor.getTime()) || anchor.toISOString().slice(0, 10) !== date
    || date < '1900-01-01' || date > '9999-12-24') throw new Error('invalid_date');
  anchor.setUTCDate(anchor.getUTCDate() - (anchor.getUTCDay() + 6) % 7);
  const dates = Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * DAY).toISOString().slice(0, 10));
  return { from: dates[0], to: dates[6], dates };
}

export async function loadWeeklyDashboard(db, userId, range) {
  const totals = { activity_count: 0, distance_m: 0, duration_sec: 0 };
  const days = range.dates.map(date => ({ date, activity_count: 0 }));
  let cursor = null;
  let recent = [];
  // Keyset paging: totals are not limited to the visible latest 50 or PostgREST's row cap.
  // Continue until an empty page, including deployments with a lower-than-requested cap.
  for (;;) {
    let query = db.from('activities').select('id,sport,performed_on,duration_sec,distance_m')
      .eq('user_id', userId).gte('performed_on', range.from).lte('performed_on', range.to)
      .order('id', { ascending: true }).limit(500);
    if (cursor != null) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('invalid_activity_response');
    if (!data.length) break;
    const nextCursor = data.at(-1).id;
    if (cursor != null && BigInt(nextCursor) <= BigInt(cursor)) throw new Error('invalid_activity_cursor');
    for (const row of data) {
      totals.activity_count++;
      totals.distance_m += row.distance_m ?? 0;
      totals.duration_sec += row.duration_sec;
      const day = days.find(item => item.date === row.performed_on);
      if (day) day.activity_count++;
    }
    recent = [...recent, ...data].sort((a, b) =>
      b.performed_on.localeCompare(a.performed_on) || (BigInt(b.id) > BigInt(a.id) ? 1 : -1)).slice(0, 50);
    cursor = nextCursor;
  }
  return { period: 'week', from: range.from, to: range.to, totals, days, recent };
}
