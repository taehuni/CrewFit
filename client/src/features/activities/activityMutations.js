import { validActivityId } from './activityDetail.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { ACTIVITY_SPORTS, hasDistance } from './sports.js';

function notFound() {
  return Object.assign(new Error('기록을 찾을 수 없어요.'), { code: 'not_found' });
}
export async function updateActivity(db, userId, id, { activity, sets }) {
  if (!validActivityId(id)) throw notFound();
  let result;
  if (activity.sport === 'gym') {
    result = await db.rpc('update_gym_activity', {
      p_activity_id: id, p_performed_on: activity.performed_on,
      p_duration_sec: activity.duration_sec, p_note: activity.note, p_sets: sets,
    });
  } else if (ACTIVITY_SPORTS.includes(activity.sport)) {
    const { performed_on, duration_sec, distance_m, note } = activity;
    const update = { performed_on, duration_sec, note };
    if (hasDistance(activity.sport)) update.distance_m = distance_m;
    if (activity.sport === 'swimming' && activity.details !== undefined) update.details = activity.details;
    result = await db.from('activities').update(update)
      .eq('id', id).eq('user_id', userId).eq('sport', activity.sport).select('id').maybeSingle();
  } else {
    throw new Error('아직 수정할 수 없는 종목입니다.');
  }
  if (result.error) throw result.error;
  if (result.data == null) throw notFound();
}

export async function deleteActivity(db, userId, id) {
  if (!validActivityId(id)) throw notFound();
  // The parent DELETE and FK cascades execute in a single DB transaction.
  const { data, error } = await db.from('activities').delete()
    .eq('id', id).eq('user_id', userId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
}

export async function invalidateActivityData(cache, userId) {
  await Promise.all([
    cache.invalidateQueries({ queryKey: queryKeys.activitiesRoot(userId) }),
    cache.invalidateQueries({ queryKey: queryKeys.dashboardRoot(userId) }),
  ]);
}
