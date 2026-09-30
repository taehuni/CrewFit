export async function loadOwnRoute(db, userId, activityId) {
  if (!/^[1-9]\d*$/.test(String(activityId))) return null;
  const own = await db.from('activities').select('id').eq('id', activityId).eq('user_id', userId).maybeSingle();
  if (own.error) throw own.error;
  if (!own.data) return null;
  const { data, error } = await db.from('activity_routes').select('points').eq('activity_id', activityId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function loadPostRoute(db, postId) {
  if (!/^[1-9]\d*$/.test(String(postId))) return null;
  const post = await db.from('posts').select('activity_id,include_route').eq('id', postId).maybeSingle();
  if (post.error) throw post.error;
  if (!post.data?.include_route || !post.data.activity_id) return null;
  const { data, error } = await db.from('activity_routes').select('points').eq('activity_id', post.data.activity_id).maybeSingle();
  if (error) throw error;
  return data;
}
