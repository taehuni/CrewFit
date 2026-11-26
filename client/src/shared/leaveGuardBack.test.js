import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryRouter} from 'react-router';
import {listenForLeaveGuardBack} from './leaveGuardBack.js';
import {consumeSurfaceBack} from './nativeBack.js';

const flushHistory = () => new Promise(resolve => setImmediate(resolve));

test('Back cancels a pending leave confirmation without another POP or lost history', async t => {
  const router = createMemoryRouter([{path:'*'}], {initialEntries:['/home','/coach','/pose']});
  t.after(() => router.dispose());
  let dirty = true, navigationRequests = 0;
  router.getBlocker('leave', () => dirty);
  const blocker = () => router.state.blockers.get('leave');
  const target = new EventTarget();
  const pressBack = async () => {
    if (consumeSurfaceBack(target)) return;
    navigationRequests++;
    await router.navigate(-1);
    await flushHistory();
  };

  await pressBack();
  assert.equal(blocker().state, 'blocked');
  assert.equal(blocker().location.pathname, '/coach');
  const release = listenForLeaveGuardBack(target, () => blocker().reset());
  await pressBack();
  assert.equal(blocker().state, 'unblocked');
  assert.equal(router.state.location.pathname, '/pose');
  assert.equal(navigationRequests, 1);

  release();
  await pressBack();
  assert.equal(navigationRequests, 2);
  assert.equal(blocker().location.pathname, '/coach');
  blocker().proceed();
  await flushHistory();
  assert.equal(router.state.location.pathname, '/coach');
  dirty = false;
  await pressBack();
  assert.equal(router.state.location.pathname, '/home');
});

// Node's flat EventTarget ignores capture ordering. This window-target double
// applies DOM capture-before-bubble ordering; native EventTarget still dispatches
// callbacks and implements cancellation/stopImmediatePropagation. Browser hook
// lifecycle and focus restoration remain separate UI checks.
function windowBackTarget() {
  let listeners = [];
  const captureOf = options => typeof options === 'boolean' ? options : options?.capture === true;
  return {
    addEventListener(type, listener, options = false) { listeners.push({type,listener,capture:captureOf(options)}); },
    removeEventListener(type, listener, options = false) {
      const capture = captureOf(options);
      listeners = listeners.filter(item => item.type !== type || item.listener !== listener || item.capture !== capture);
    },
    dispatchEvent(event) {
      const target = new EventTarget();
      for (const capture of [true,false]) {
        for (const item of listeners.filter(item => item.capture === capture)) {
          target.addEventListener(item.type, item.listener);
        }
      }
      return target.dispatchEvent(event);
    },
  };
}

test('leave confirmation takes priority over an earlier open surface and releases it on cleanup', () => {
  const target = windowBackTarget();
  let surfaceClosed = 0, reset = 0;
  target.addEventListener('crewfit:surface-back', event => { event.preventDefault(); surfaceClosed++; });
  const release = listenForLeaveGuardBack(target, () => { reset++; });
  assert.equal(consumeSurfaceBack(target), true);
  assert.equal(reset, 1);
  assert.equal(surfaceClosed, 0);
  release();
  assert.equal(consumeSurfaceBack(target), true);
  assert.equal(reset, 1);
  assert.equal(surfaceClosed, 1);
});
