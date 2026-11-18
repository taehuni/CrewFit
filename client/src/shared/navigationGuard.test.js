import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRouter } from 'react-router';

// Router contract tests for the useLeaveGuard integration. DOM focus and the
// React hook's subscription lifecycle still require a browser check.
function guardedRouter(t, initialEntries = ['/home', '/pose']) {
  const router = createMemoryRouter([{ path: '*' }], { initialEntries });
  t.after(() => router.dispose());
  const condition = { current: true };
  router.getBlocker('leave', ({ currentLocation, nextLocation }) => {
    const enabled = typeof condition.current === 'function' ? condition.current() : condition.current;
    return Boolean(enabled) && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search);
  });
  return { router, condition, blocker: () => router.state.blockers.get('leave') };
}

const flushHistory = () => new Promise(resolve => setImmediate(resolve));

test('unsaved route PUSH remains pending until reset or proceed', async t => {
  const { router, blocker } = guardedRouter(t);
  await router.navigate('/coach');
  assert.equal(router.state.location.pathname, '/pose');
  assert.equal(blocker().state, 'blocked');
  assert.equal(blocker().location.pathname, '/coach');
  blocker().reset();
  assert.equal(blocker().state, 'unblocked');
  assert.equal(router.state.location.pathname, '/pose');
  await router.navigate('/coach');
  blocker().proceed();
  await flushHistory();
  assert.equal(router.state.location.pathname, '/coach');
  assert.equal(blocker().state, 'unblocked');
});

test('browser-style POP can be canceled and then confirmed without skipping history', async t => {
  const { router, condition, blocker } = guardedRouter(t, ['/home', '/coach', '/pose']);
  await router.navigate(-1);
  assert.equal(blocker().state, 'blocked');
  assert.equal(router.state.location.pathname, '/pose');
  blocker().reset();
  await flushHistory();
  await router.navigate(-1);
  assert.equal(blocker().location.pathname, '/coach');
  blocker().proceed();
  await flushHistory();
  assert.equal(router.state.location.pathname, '/coach');
  condition.current = false;
  await router.navigate(-1);
  assert.equal(router.state.location.pathname, '/home');
});

test('hash-only jumps stay in-page while query changes require confirmation', async t => {
  const { router, blocker } = guardedRouter(t);
  await router.navigate('/pose#pose-history-title');
  assert.equal(router.state.location.hash, '#pose-history-title');
  assert.notEqual(blocker()?.state, 'blocked');
  await router.navigate('/pose?view=history');
  assert.equal(blocker().state, 'blocked');
  assert.equal(router.state.location.search, '');
});

test('latest predicate refs permit successful GPS save navigation without a render', async t => {
  const { router, condition, blocker } = guardedRouter(t, ['/activities', '/activities/track']);
  const savedId = { current: null }, kept = { current: false };
  condition.current = () => !savedId.current && !kept.current;
  await router.navigate('/activities');
  assert.equal(blocker().state, 'blocked');
  blocker().reset();
  kept.current = true;
  await router.navigate('/activities', { replace: true });
  assert.equal(router.state.location.pathname, '/activities');
  assert.equal(blocker().state, 'unblocked');
  assert.equal(router.state.historyAction, 'REPLACE');
});

test('failed save retains protection; successful save or explicit discard releases it', async t => {
  const { router, condition, blocker } = guardedRouter(t, ['/activities/track']);
  const savedId = { current: null }, discarded = { current: false };
  condition.current = () => !savedId.current && !discarded.current;
  await router.navigate('/activities');
  assert.equal(blocker().state, 'blocked');
  blocker().reset();
  savedId.current = 'saved-activity';
  await router.navigate('/activities/saved-activity', { replace: true });
  assert.equal(router.state.location.pathname, '/activities/saved-activity');
  savedId.current = null;
  discarded.current = true;
  await router.navigate('/activities');
  assert.equal(router.state.location.pathname, '/activities');
  assert.equal(blocker().state, 'unblocked');
});
