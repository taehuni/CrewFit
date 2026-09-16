export function validActivityId(id) {
  return typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
}

// D-10: own-record reads directly through the signed-in Supabase client, under RLS.
export async function loadActivityDetail(db, userId, id) {
  if (!validActivityId(id)) return null;
  const { data: activity, error } = await db.from('activities')
    .select('id,sport,performed_on,duration_sec,distance_m,note,details')
    .eq('user_id', userId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!activity) return null;
  const sets = [];
  if (activity.sport === 'gym') {
    let cursor = null;
    for (;;) {
      let query = db.from('exercise_sets')
        .select('id,exercise_name,set_no,reps,weight_kg')
        .eq('user_id', userId).eq('activity_id', id)
        .order('id', { ascending: true }).limit(500);
      if (cursor != null) query = query.gt('id', cursor);
      const { data, error: setsError } = await query;
      if (setsError) throw setsError;
      if (!Array.isArray(data)) throw new Error('invalid_sets_response');
      if (!data.length) break;
      const next = data.at(-1).id;
      if (cursor != null && BigInt(next) <= BigInt(cursor)) throw new Error('invalid_sets_cursor');
      sets.push(...data);
      cursor = next;
    }
  }
  return { activity, sets };
}

export function groupExerciseSets(sets) {
  const groups = new Map();
  for (const row of sets) {
    const key = row.exercise_name.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: row.exercise_name.trim(), sets: [] });
    groups.get(key).sets.push(row);
  }
  return [...groups.values()].map(group => ({ ...group, sets: [...group.sets].sort((a, b) => a.set_no - b.set_no) }));
}

export function detailDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return [hours && `${hours}시간`, minutes && `${minutes}분`, remainder && `${remainder}초`].filter(Boolean).join(' ') || '0분';
}
