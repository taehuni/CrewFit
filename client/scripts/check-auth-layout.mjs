// 실행 중인 로컬 Chromium CDP(9223)와 Vite(5173)를 사용. 로그인/가입 요청은 보내지 않는다.
// node scripts/check-auth-layout.mjs [스크린샷 저장 폴더]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = process.argv[2];
const target = await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const waiting = new Map();
socket.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  const entry = waiting.get(msg.id);
  if (!entry) return;
  waiting.delete(msg.id);
  clearTimeout(entry.timer);
  if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
  else entry.resolve(msg.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    waiting.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (data.exceptionDetails) throw new Error(JSON.stringify(data.exceptionDetails));
  return data.result.value;
}
try {
  await send('Page.enable');
  if (out) await mkdir(out, { recursive: true });
  for (const [route, width, height] of [['login', 320, 667], ['login', 375, 667], ['login', 959, 768], ['login', 960, 768], ['login', 1280, 800], ['login', 1440, 1000], ['signup', 375, 812], ['signup', 1440, 1000], ['forgot', 375, 667], ['reset-password', 375, 667]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    // Resizing the old page may itself reveal a desktop opening shot.
    await new Promise(resolve => setTimeout(resolve, 100));
    const previousStart = await evaluate("(() => { try { return sessionStorage.getItem('crewfit.auth.start-photo'); } catch { return null; } })()");
    await send('Page.navigate', { url: `http://127.0.0.1:5173/${route}` });
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      ready = await evaluate(`location.pathname === '/${route}' && !!document.querySelector('.auth-heading h1')`);
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `${route}: page ready`);
    await evaluate('document.fonts.ready.then(() => true)');
    const photo = await evaluate(`(async () => {
      const images = [...document.querySelectorAll('.auth-photo')];
      if (!images.length) return { loaded: false, requested: performance.getEntriesByType('resource').some(r => /auth-(runner|gym|city-run|strength|cycling)\\.jpg/.test(r.name)) };
      await Promise.all(images.map(img => img.decode()));
      return { loaded: images.length === 5 && images.every(img => img.naturalWidth > 0), requested: true,
        start: document.querySelector('.auth-photo.is-active').getAttribute('src'),
        stored: sessionStorage.getItem('crewfit.auth.start-photo') };
    })()`);
    assert.equal(photo.loaded, width >= 960, `${route}: desktop photo loads, mobile has none`);
    if (width < 960) assert.equal(photo.requested, false, `${route}: mobile must not request photo`);
    if (width >= 960) {
      assert.equal(photo.start, photo.stored, 'remember the actual opening photo');
      if (previousStart) assert.notEqual(photo.start, previousStart, 'next visit must not repeat opening photo');
    }
    assert.equal(await evaluate("!!document.querySelector('.auth-lanes')"), false, 'old track artwork removed');
    const metrics = await evaluate(`(() => {
      const rect = s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { left:r.left, right:r.right, top:r.top, bottom:r.bottom } : null; };
      return { width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
        email:rect('#email'), primary:rect('button[type="submit"]'), signup:rect('.auth-secondary'),
        name:rect('#real-name'), realNameRequired:document.querySelector('#real-name')?.required,
        h1s:document.querySelectorAll('h1').length, storyVisible:getComputedStyle(document.querySelector('.auth-story-copy')).display !== 'none',
        oldStats:!!document.querySelector('.auth-run'), hint:document.querySelector('#real-name-hint')?.textContent,
        fields:[...document.querySelectorAll('input')].map(e => ({ id:e.id,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right })) };
    })()`);
    assert.equal(metrics.width, width);
    assert.ok(metrics.scrollWidth <= width, `${route}: horizontal overflow`);
    assert.equal(metrics.h1s, 1);
    assert.equal(metrics.oldStats, false);
    for (const field of metrics.fields) assert.ok(field.left >= 0 && field.right <= width, `${route}: clipped ${field.id}`);
    assert.equal(metrics.storyVisible, width >= 960);
    if (route === 'login' && width < 768) {
      assert.ok(metrics.email.bottom < height, 'email above fold');
      assert.ok(metrics.primary.bottom < height, 'login above fold');
      assert.ok(metrics.signup.bottom < height, 'signup above fold');
    }
    if (route === 'signup') {
      assert.equal(metrics.realNameRequired, true);
      assert.ok(metrics.hint.includes('본인과 가입이 승인된 크루의 크루장만'));
    }
    if (out) {
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(join(out, `${route}-${width}.png`), Buffer.from(data, 'base64'));
    }
    console.log(JSON.stringify({ route, width, height, ...metrics }));
  }
  if (process.argv.includes('--photos')) {
    for (const index of [3, 4]) {
      const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
        source: `sessionStorage.removeItem('crewfit.auth.start-photo'); Math.random = () => ${(index + 0.5) / 5};`,
      });
      try {
        for (const width of [1440, 960]) {
          await send('Emulation.setDeviceMetricsOverride', { width, height: width === 1440 ? 1000 : 768, deviceScaleFactor: 1, mobile: false });
          await send('Page.navigate', { url: 'http://127.0.0.1:5173/login' });
          for (let i = 0; i < 50; i++) {
            if (await evaluate("document.querySelectorAll('.auth-photo').length === 5")) break;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          await evaluate("Promise.all([document.fonts.ready, ...[...document.querySelectorAll('.auth-photo')].map(i => i.decode())])");
          assert.equal(await evaluate("Number(document.querySelector('.auth-photos').dataset.active)"), index, 'controlled random opening photo');
          await new Promise(resolve => setTimeout(resolve, 1400));
          if (out) {
            const { data } = await send('Page.captureScreenshot', { format: 'png' });
            await writeFile(join(out, `login-photo-${index}-${width}.png`), Buffer.from(data, 'base64'));
          }
        }
      } finally { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier }); }
    }
    console.log('PASS: new photos can open first at both desktop widths');
  }
  if (process.argv.includes('--motion')) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
      source: "sessionStorage.removeItem('crewfit.auth.start-photo'); Math.random = () => 0.99;",
    });
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/login' });
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    for (let i = 0; i < 50; i++) {
      if (await evaluate("!!document.querySelector('.auth-photo-control')")) break;
      await sleep(100);
    }
    await evaluate("Promise.all([...document.querySelectorAll('.auth-photo')].map(i => i.decode()))");
    const active = () => evaluate("Number(document.querySelector('.auth-photos').dataset.active)");
    const toggle = () => evaluate("document.querySelector('.auth-photo-control').click()");
    const capture = async name => {
      if (!out) return;
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(out, name), Buffer.from(data, 'base64'));
    };
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    const start = await active();
    assert.equal(start, 4, 'random opening can be the fifth photo');
    await evaluate("document.querySelector('#email').value = 'layout-check@example.com'");
    await sleep(9500);
    assert.equal(await active(), (start + 1) % 5, 'autoplay wraps from last to first');
    await toggle();
    await capture('login-motion-paused.png');
    await sleep(8500);
    assert.equal(await active(), (start + 1) % 5, 'pause holds current photo');
    await toggle();
    await sleep(9500);
    assert.equal(await active(), (start + 2) % 5, 'resume advances to next photo');
    await capture('login-motion-resumed.png');
    assert.equal(await evaluate("document.querySelector('#email').value"), 'layout-check@example.com', 'form value survives rotation');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await sleep(8500);
    assert.equal(await active(), (start + 2) % 5, 'reduced motion stops autoplay');
    assert.ok(await evaluate("parseFloat(getComputedStyle(document.querySelector('.auth-photo')).transitionDuration) <= 0.00001"), 'reduced-motion transition is effectively disabled');
    assert.equal(await evaluate("!!document.querySelector('.auth-photo-control')"), false);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await sleep(8500);
    assert.equal(await active(), (start + 3) % 5, 'autoplay resumes after preference changes');
    console.log('PASS: autoplay, pause, resume, form preservation, reduced motion, wraparound');
  }
} finally {
  await fetch(`http://127.0.0.1:9223/json/close/${target.id}`).catch(() => {});
  socket.close();
}
