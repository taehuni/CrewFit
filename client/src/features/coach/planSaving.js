// Saving does not call Calendar. Use the returned rows immediately instead of
// keeping the form busy until the entire coaching history has been reloaded.
export async function persistWorkoutPlans(request, turn_id, items, timeoutMs = 30000) {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), timeoutMs);
 try {
  const rows = await request({body:{turn_id,items},signal:controller.signal});
  if (!Array.isArray(rows) || !items.every(item => rows.some(row => row.id && row.turn_id === turn_id && row.position === item.position))) {
   throw new Error('저장 결과를 확인하지 못했어요. 저장한 운동 계획을 확인한 뒤 다시 시도해 주세요.');
  }
  return rows;
 } catch (error) {
  if (controller.signal.aborted) throw new Error('저장 응답이 늦어지고 있어요. 저장한 운동 계획을 확인한 뒤 다시 시도해 주세요. 같은 제안은 중복 저장되지 않아요.');
  throw error;
 } finally { clearTimeout(timer); }
}

export function refreshSavedWorkoutPlans(cache, userId, key, saved) {
 cache.setQueryData(key, old => ({ ...old,
  plans: [...(old?.plans || []).filter(plan => !saved.some(row => row.id === plan.id)), ...saved]
   .sort((a, b) => b.scheduled_on.localeCompare(a.scheduled_on)),
 }));
 // Review and recent conversation use different keys. Mark both stale so going
 // back cannot retain the pre-save count during the normal 30-second cache age.
 return Promise.all([
  cache.invalidateQueries({queryKey:['coach', userId]}),
  cache.invalidateQueries({queryKey:['workout-plans', userId]}),
 ]);
}
