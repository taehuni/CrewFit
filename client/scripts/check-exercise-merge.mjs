// Isolated components + mock mutations only. Uses Vite 5173 and test Chromium CDP 9223.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const out = process.argv[2];
const target = await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data), job = pending.get(message.id);
  if (!job) return;
  pending.delete(message.id); clearTimeout(job.timer);
  message.error ? job.reject(new Error(JSON.stringify(message.error))) : job.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id, timer = setTimeout(() => { pending.delete(key); reject(new Error(method + ' timeout')); }, 15000);
    pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 100));
async function shot(name) {
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'no horizontal overflow');
  if (!out) return;
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(join(out, name + '.png'), Buffer.from(data, 'base64'));
}
try {
  if (out) await mkdir(out, { recursive: true });
  await send('Page.enable'); await send('Page.bringToFront');
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/activities/exercises' });
  for (let n = 0; n < 100; n++) { if (await evaluate("!!document.querySelector('.auth-heading')")) break; await settle(); }
  assert.equal(await evaluate('location.pathname'), '/login', 'real route is protected');
  await evaluate(`(async()=>{
    const shell=await fetch('/src/shared/AppShell.jsx').then(r=>r.text());
    const routerURL=shell.split('"').find(x=>x.startsWith('/node_modules/.vite/deps/react-router.js'));
    const [R,D,T,S,V]=await Promise.all([import('/node_modules/.vite/deps/react.js'),import('/node_modules/.vite/deps/react-dom_client.js'),import(routerURL),import('/src/shared/AppShell.jsx'),import('/src/features/activities/ExerciseNamesView.jsx')]);
    const h=R.default.createElement;
    document.getElementById('root').style.display='none';
    const mount=document.createElement('div');mount.id='merge-test';document.body.append(mount);
    const root=(D.createRoot||D.default.createRoot)(mount);
    window.mergeCalls=[];window.mergeRefetches=0;
    window.renderMerge=state=>{
      const catalog={isPending:state==='loading',isError:state==='error',refetch:()=>window.mergeRefetches++,data:state==='empty'?[]:[
        {name:'벤치 프레스',activityCount:2,setCount:6},{name:'벤치프레스',activityCount:3,setCount:9},{name:'긴 운동 이름 '.repeat(10),activityCount:1,setCount:1}
      ]};
      root.render(h(T.MemoryRouter,{initialEntries:['/activities/exercises'],key:state},h(T.Routes,null,h(T.Route,{element:h(S.WorkspaceFrame,{nickname:'테스트',number:'027'})},h(T.Route,{path:'/activities/exercises',element:h(V.default,{catalog,returnTo:'/activities?sport=gym',onMerge:input=>{
        window.mergeCalls.push(input);return new Promise((resolve,reject)=>{window.mergeResolve=resolve;window.mergeReject=reject;});
      }})})))));
    };
    window.mergeFill=(id,value)=>{
      const input=document.getElementById(id);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    };
  })()`);
  for (const [state, width] of [['normal',1440],['normal',375],['normal',320],['empty',320],['loading',375],['error',375]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await evaluate('window.renderMerge(' + JSON.stringify(state) + ')'); await settle();
    await evaluate('document.fonts.ready');
    assert.equal(await evaluate("document.querySelector('.exercise-manager-heading a').getAttribute('href')"), '/activities?sport=gym');
    if (state === 'empty') assert.match(await evaluate("document.querySelector('.exercise-manager-state').textContent"), /아직 헬스 기록/);
    if (state === 'loading') assert.equal(await evaluate("document.querySelector('.exercise-manager-state').getAttribute('role')"), 'status');
    if (state === 'error') {
      await evaluate("document.querySelector('.exercise-manager-state button').click()");
      assert.equal(await evaluate('window.mergeRefetches'), 1);
    }
    await shot('merge-' + state + '-' + width);
  }
  await evaluate("window.renderMerge('interactive')"); await settle();
  await evaluate("document.querySelector('#merge-test form').requestSubmit()"); await settle();
  assert.match(await evaluate("document.querySelector('#merge-test .form-msg[data-tone=error]').textContent"), /기존 이름/);
  await evaluate("document.getElementById('exercise-from').value='벤치 프레스';document.getElementById('exercise-from').dispatchEvent(new Event('change',{bubbles:true}));window.mergeFill('exercise-to','벤치프레스')"); await settle();
  await evaluate("document.querySelector('#merge-test form').requestSubmit()"); await settle();
  assert.equal(await evaluate('window.mergeCalls.length'), 0, 'preview must not mutate');
  assert.equal(await evaluate('document.activeElement.id'), 'merge-confirm-title');
  assert.match(await evaluate("document.querySelector('.exercise-merge-confirm').textContent"), /2개 운동 기록 · 6개 세트/);
  for (const width of [1440,375,320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 }); await settle();
    await shot('merge-confirm-' + width);
  }
  await evaluate("document.querySelector('.exercise-merge-actions button:last-child').click()"); await settle();
  assert.equal(await evaluate('window.mergeCalls.length'), 0);
  assert.equal(await evaluate("document.getElementById('exercise-to').value"), '벤치프레스');
  await evaluate("document.querySelector('#merge-test form').requestSubmit()"); await settle();
  await evaluate("document.querySelector('.exercise-merge-actions button').click();document.querySelector('.exercise-merge-actions button').click()"); await settle();
  assert.equal(await evaluate('window.mergeCalls.length'), 1, 'double click deduplicated');
  assert.deepEqual(await evaluate('window.mergeCalls[0]'), { from: '벤치 프레스', to: '벤치프레스' });
  assert.equal(await evaluate("document.querySelectorAll('.exercise-merge-actions button:disabled').length"), 2);
  await evaluate("window.mergeReject({code:'CONFLICT',message:'같은 기록의 세트 번호 충돌. 아무것도 변경하지 않았습니다.'})"); await settle();
  assert.match(await evaluate("document.querySelector('.exercise-merge-confirm [role=alert]').textContent"), /충돌/);
  assert.equal(await evaluate("document.querySelector('.exercise-merge-names dd').textContent"), '벤치 프레스');
  await shot('merge-conflict-320');
  await evaluate("document.querySelector('.exercise-merge-refresh').click()"); await settle();
  assert.equal(await evaluate('window.mergeRefetches'), 2);
  await evaluate("document.querySelector('#merge-test form').requestSubmit()"); await settle();
  await evaluate("document.querySelector('.exercise-merge-actions button').click()"); await settle();
  await evaluate("window.mergeReject(new Error('offline'))"); await settle();
  assert.match(await evaluate("document.querySelector('.exercise-merge-confirm [role=alert]').textContent"), /새로 조회/);
  await evaluate("document.querySelector('.exercise-merge-actions button').click()"); await settle();
  await evaluate('window.mergeResolve({updated:7})'); await settle();
  assert.match(await evaluate("document.querySelector('.exercise-manager > [role=status]').textContent"), /7개 세트/);
  assert.equal(await evaluate("document.getElementById('exercise-from').value"), '');
  assert.equal(await evaluate("document.getElementById('exercise-to').value"), '');
  await shot('merge-success-320');
  console.log('Merge protected route, loading/empty/error, preview/cancel/counts, double-submit, conflict/network recovery, success and 320–1440px layouts passed (mock mutations only).');
} finally {
  await fetch('http://127.0.0.1:9223/json/close/' + target.id).catch(() => {});
  socket.close();
}
