import { queryKeys } from '../../shared/queryKeys.js';

export async function refreshCrewMembership(cache, userId, crewId, leaving = false) {
  // Reset removes already-rendered restricted data before querying under new RLS.
  const refreshAccess = key => leaving
    ? cache.resetQueries({ queryKey: key })
    : cache.invalidateQueries({ queryKey: key });
  await Promise.all([
    cache.invalidateQueries({ queryKey: queryKeys.crewStatsRoot(userId, String(crewId)) }),
    cache.invalidateQueries({ queryKey: queryKeys.crewDetail(userId, String(crewId)) }),
    cache.invalidateQueries({ queryKey: queryKeys.crewListRoot(userId) }),
    refreshAccess(queryKeys.postsRoot(userId)),
    refreshAccess(['feedContext', userId]),
    refreshAccess(queryKeys.memberRoot(userId)),
    refreshAccess(['crew-chat-messages', userId]),
    cache.invalidateQueries({ queryKey: ['crew-chat-rooms', userId] }),
  ]);
}
