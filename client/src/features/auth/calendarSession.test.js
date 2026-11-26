import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { CALENDAR_TOKEN_KEY, createCalendarSessionStore, clearRejectedCalendarSession } from './calendarSession.js';
import { calendarReturnProblem } from './calendarConnection.js';

const session = (id = 'owner', provider = 'fixture-google') => ({ user: { id }, access_token: 'fixture-access',
  refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, ...(provider ? { provider_token: provider } : {}) });
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('provider token survives the installed Supabase refreshSession and a same-tab reload', async () => {
  const storage = memoryStorage(), cache = memoryStorage();
  storage.setItem('calendar-sdk-test', JSON.stringify(session()));
  const client = createClient('https://example.invalid', 'fixture-anon', { auth: {
    storage, storageKey: 'calendar-sdk-test', autoRefreshToken: false, detectSessionInUrl: false,
  }, global: { fetch: async url => {
    assert.match(String(url), /token\?grant_type=refresh_token/);
    return Response.json({ access_token: 'fixture-renewed', refresh_token: 'fixture-renewed-refresh',
      expires_in: 3600, token_type: 'bearer', user: { id: 'owner' } });
  } } });
  await client.auth.initialize();
  const store = createCalendarSessionStore({ storage: cache });
  store.apply((await client.auth.getSession()).data.session);
  const refreshed = await client.auth.refreshSession();
  assert.equal(refreshed.error, null);
  assert.equal(refreshed.data.session.provider_token, undefined);
  assert.equal(store.apply(refreshed.data.session).provider_token, 'fixture-google');
  assert.equal(createCalendarSessionStore({ storage: cache }).apply(refreshed.data.session).provider_token, 'fixture-google');
  assert.doesNotMatch(cache.getItem(CALENDAR_TOKEN_KEY), /refresh|fixture-access|fixture-renewed/);
  await client.auth.stopAutoRefresh();
});

test('sign out and account change remove the previous owner provider token', () => {
  const storage = memoryStorage(), store = createCalendarSessionStore({ storage });
  store.apply(session());
  assert.equal(store.apply(session('other', null)).provider_token, undefined);
  assert.equal(storage.getItem(CALENDAR_TOKEN_KEY), null);
  store.apply(session());
  assert.equal(store.apply(null), null);
  assert.equal(storage.getItem(CALENDAR_TOKEN_KEY), null);
  assert.equal(store.apply(session('owner', null)).provider_token, undefined);
});

test('expired and denied connections stay rejected through refresh, repeated SDK events and reload', () => {
  const storage = memoryStorage(), store = createCalendarSessionStore({ storage });
  store.apply(session());
  assert.equal(store.invalidate('owner', 'fixture-google', '연결·재연결이 필요해요.'), true);
  assert.equal(store.apply(session()).provider_token, undefined);
  assert.equal(store.apply(session('owner', null)).provider_token, undefined);
  const reloaded = createCalendarSessionStore({ storage });
  assert.equal(reloaded.apply(session()).provider_token, undefined);
  assert.equal(reloaded.issue(), '연결·재연결이 필요해요.');
  assert.doesNotMatch(storage.getItem(CALENDAR_TOKEN_KEY), /fixture-google/);
  assert.equal(reloaded.apply(session('owner', 'fixture-new'), { freshProvider: true }).provider_token, 'fixture-new');
  assert.equal(reloaded.issue(), '');
  assert.equal(reloaded.invalidate('owner', 'fixture-google'), false);
  assert.equal(reloaded.invalidate('other', 'fixture-new'), false);
});

test('repeated refresh does not extend the one-hour retention bound', () => {
  let now = 1000;
  const store = createCalendarSessionStore({ storage: memoryStorage(), now: () => now });
  store.apply(session());
  now += 59 * 60000; assert.equal(store.apply(session()).provider_token, 'fixture-google');
  now += 60000; assert.equal(store.apply(session()).provider_token, undefined);
  assert.match(store.issue(), /만료/);
  assert.equal(store.apply(session('owner', null)).provider_token, undefined);
});

test('storage restrictions fall back to memory and still clear on logout', () => {
  const storage = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
  const store = createCalendarSessionStore({ storage });
  store.apply(session());
  assert.equal(store.apply(session('owner', null)).provider_token, 'fixture-google');
  store.apply(null);
  assert.equal(store.apply(session('owner', null)).provider_token, undefined);
});

test('calendar OAuth rejects another account and invalid return context, but cancellation preserves login', () => {
  const context = { calendar: true, authLink: { present: true, error: false },
    stored: { userId: 'owner', at: 100 }, returned: null, session: session() };
  assert.equal(calendarReturnProblem(context, 101), null);
  assert.equal(calendarReturnProblem({ ...context, session: session('other') }, 101), 'account_mismatch');
  assert.equal(calendarReturnProblem({ ...context, stored: null }, 101), 'invalid_request');
  assert.equal(calendarReturnProblem(context, 900101), 'invalid_request');
  assert.equal(calendarReturnProblem({ ...context, authLink: { present: true, error: true } }, 101), null);
  assert.equal(calendarReturnProblem({ ...context, calendar: false, session: session('other') }, 101), null);
  assert.equal(calendarReturnProblem({ ...context, authLink: { present: false }, session: session('other') }, 101), null);
  assert.equal(calendarReturnProblem({ ...context, calendar: false, authLink: { present: false },
    stored: { rejectedUserId: 'other' }, session: session('other') }, 101), 'account_mismatch');
  assert.equal(calendarReturnProblem({ ...context, calendar: false, authLink: { present: false },
    stored: { rejectedUserId: 'other' } }, 101), null);
});

test('rejected account cleanup is local and requires confirmed empty SDK storage before leaving callback', async () => {
  let current = session('other'), scope;
  const auth = { signOut: async options => { scope = options.scope; current = null; return { error: null }; },
    getSession: async () => ({ data: { session: current }, error: null }) };
  assert.equal(await clearRejectedCalendarSession(auth), true);
  assert.equal(scope, 'local');
  current = session('other'); auth.signOut = async () => { throw Error('fixture-network-error'); };
  assert.equal(await clearRejectedCalendarSession(auth), false);
  auth.signOut = async () => { current = null; return { error: Error('fixture-network-error') }; };
  assert.equal(await clearRejectedCalendarSession(auth), true);
});

test('after rejected-account cleanup a fresh login page can sign in to the original account', async () => {
  const storage = memoryStorage();
  storage.setItem('calendar-relogin-test', JSON.stringify(session('other')));
  const options = { auth: { storage, storageKey: 'calendar-relogin-test', autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async url => {
      if (String(url).includes('/logout')) { assert.match(String(url), /scope=local/); return new Response(null, { status: 204 }); }
      assert.match(String(url), /token\?grant_type=password/);
      return Response.json({ ...session('owner', null), expires_in: 3600, token_type: 'bearer' });
    } } };
  const rejected = createClient('https://example.invalid', 'fixture-anon', options);
  await rejected.auth.initialize();
  assert.equal(await clearRejectedCalendarSession(rejected.auth), true);
  await rejected.auth.stopAutoRefresh();
  // The recovery link loads a document, creating a fresh provider and SDK instance.
  const login = createClient('https://example.invalid', 'fixture-anon', options);
  await login.auth.initialize();
  assert.equal((await login.auth.getSession()).data.session, null);
  const result = await login.auth.signInWithPassword({ email: 'fixture@example.invalid', password: 'fixture-password' });
  assert.equal(result.error, null);
  assert.equal(calendarReturnProblem({ calendar: false, authLink: { present: false }, session: result.data.session }), null);
  assert.equal(createCalendarSessionStore({ storage: memoryStorage() }).apply(result.data.session).user.id, 'owner');
  await login.auth.stopAutoRefresh();
});
