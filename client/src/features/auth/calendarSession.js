// Supabase refreshes CrewFit credentials, but does not refresh Google credentials.
// Keep our refresh-recovery cache tab-scoped; the SDK can supply an existing
// provider token from its own session storage. Never cache Google refresh tokens
// or extend a cached token's retention window.
export const CALENDAR_TOKEN_KEY = 'crewfit-calendar-provider';
const MAX_AGE = 60 * 60 * 1000;
const RECONNECT = '구글 연결이 만료됐어요. 연결·재연결을 눌러 주세요.';

export function createCalendarSessionStore({ storage, now = Date.now } = {}) {
  let record = null;
  try { record = JSON.parse(storage?.getItem(CALENDAR_TOKEN_KEY) || 'null'); } catch {}
  function save(value) {
    record = value;
    try {
      if (value) storage?.setItem(CALENDAR_TOKEN_KEY, JSON.stringify(value));
      else storage?.removeItem(CALENDAR_TOKEN_KEY);
    } catch { /* Storage-restricted browsers retain the token in memory only. */ }
  }
  function clear() { save(null); }
  function apply(session, { freshProvider = false } = {}) {
    const owner = session?.user?.id;
    if (!owner) { clear(); return session; }
    if (record && record.userId !== owner) clear();
    if (record?.token && (!Number.isFinite(record.at) || now() < record.at || now() - record.at >= MAX_AGE)) {
      save({ userId: owner, issue: RECONNECT });
    }
    const incoming = session.provider_token;
    if (typeof incoming === 'string' && incoming && (!record?.issue || freshProvider)) {
      // Repeated INITIAL_SESSION/SIGNED_IN events must not renew the retention window.
      if (freshProvider || incoming !== record?.token) save({ userId: owner, token: incoming, at: now() });
    }
    const { provider_token, provider_refresh_token, ...crewfitSession } = session;
    return record?.token ? { ...crewfitSession, provider_token: record.token } : crewfitSession;
  }
  function invalidate(userId, token, issue = RECONNECT) {
    // A late response for an old account/token must not discard a newer connection.
    if (!token || record?.userId !== userId || record?.token !== token) return false;
    save({ userId, issue });
    return true;
  }
  return { apply, invalidate, clear, issue: () => record?.issue || '' };
}

export async function clearRejectedCalendarSession(auth) {
  // Revoke only the accidentally selected session, never that account's other devices.
  try { await auth.signOut({ scope: 'local' }); } catch {}
  try {
    const result = await auth.getSession();
    return !result.error && !result.data?.session;
  } catch { return false; }
}
