// Isolated meal screens + mock mutations only. Uses Vite 5173 and test Chromium CDP 9223.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = process.argv[2];
const target = await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' }).then(response => response.json());
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
const settle = () => new Promise(resolve => setTimeout(resolve, 120));
async function shot(name) {
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), name + ': no horizontal overflow');
  if (!out) return;
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(join(out, name + '.png'), Buffer.from(data, 'base64'));
}

try {
  if (out) await mkdir(out, { recursive: true });
  await send('Page.enable'); await send('Page.bringToFront');
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/meals' });
  for (let n = 0; n < 100; n++) { if (await evaluate("!!document.querySelector('.auth-heading')")) break; await settle(); }
  assert.equal(await evaluate('location.pathname'), '/login', 'real meal route is protected');
  await evaluate(`(async()=>{
    const shell=await fetch('/src/shared/AppShell.jsx').then(r=>r.text());
    const routerURL=shell.split('"').find(x=>x.startsWith('/node_modules/.vite/deps/react-router.js'));
    const [R,D,T,S,L,F,V]=await Promise.all([
      import('/node_modules/.vite/deps/react.js'),import('/node_modules/.vite/deps/react-dom_client.js'),import(routerURL),
      import('/src/shared/AppShell.jsx'),import('/src/features/meals/MealListView.jsx'),
      import('/src/features/meals/MealForm.jsx'),import('/src/features/meals/MealDetailView.jsx')
    ]);
    const h=R.default.createElement;
    document.getElementById('root').style.display='none';
    const mount=document.createElement('div');mount.id='meal-test';document.body.append(mount);
    const root=(D.createRoot||D.default.createRoot)(mount);
    const frame=(path,element)=>h(T.MemoryRouter,{initialEntries:[path],key:path+window.mealRenderKey++},h(T.Routes,null,h(T.Route,{element:h(S.WorkspaceFrame,{nickname:'테스트',number:'027'})},h(T.Route,{path:'*',element}))));
    window.mealRenderKey=0;window.mealRefetches=0;window.mealMore=0;window.mealSaves=[];window.mealDeletes=0;
    window.mealRows=[
      {id:'31',eaten_on:'2026-09-16',meal_type:'lunch',items:[{name:'현미밥',amount:'1공기',kcal:310},{name:'닭가슴살',amount:'150g',kcal:180}],note:'운동 전 식사'},
      {id:'30',eaten_on:'2026-09-15',meal_type:'snack',items:[{name:'바나나',amount:null,kcal:null}],note:null}
    ];
    window.renderMealList=state=>{
      const rows=state==='empty'?[]:window.mealRows;
      const meals={isPending:state==='loading',isError:state==='error'||state==='partial',isFetching:false,isFetchingNextPage:false,isFetchNextPageError:state==='partial',hasNextPage:state==='more',data:['loading','error'].includes(state)?undefined:{pages:[{items:rows}]},refetch:()=>window.mealRefetches++,fetchNextPage:()=>{window.mealMore++;return Promise.resolve();}};
      root.render(frame('/meals',h(L.default,{meals})));
    };
    window.renderMealForm=(editing=false)=>root.render(frame(editing?'/meals/31/edit':'/meals/new',h(F.default,{today:'2026-09-16',editing,initialValues:editing?{date:'2026-09-16',type:'lunch',items:[{name:'현미밥',amount:'1공기',kcal:'310'}],note:'운동 전 식사'}:undefined,cancelTo:editing?'/meals/31':'/meals',onSave:meal=>{window.mealSaves.push(meal);return new Promise((resolve,reject)=>{window.mealSaveResolve=resolve;window.mealSaveReject=reject;});}})));
    window.renderMealDetail=state=>{
      const detail={isPending:state==='loading',isError:state==='error',data:state==='missing'?null:window.mealRows[0],refetch:()=>window.mealRefetches++};
      root.render(frame('/meals/31',h(V.default,{detail,onDelete:()=>{window.mealDeletes++;return new Promise((resolve,reject)=>{window.mealDeleteResolve=resolve;window.mealDeleteReject=reject;});}})));
    };
    window.fill=(selector,value)=>{const input=document.querySelector(selector);const proto=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};
  })()`);

  for (const [state, width] of [['normal',1440],['normal',375],['normal',320],['empty',375],['loading',375],['error',375],['partial',375],['more',375]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await evaluate('window.renderMealList(' + JSON.stringify(state) + ')'); await settle(); await evaluate('document.fonts.ready');
    assert.equal(await evaluate("document.querySelectorAll('.ws-nav-item[aria-current=page]').length"), 1);
    assert.equal(await evaluate("document.querySelector('.ws-nav-item[aria-current=page] span').textContent"), '기록');
    assert.equal(await evaluate("document.querySelector('.record-tabs [aria-current=page]').textContent"), '식단');
    if (state === 'normal') assert.equal(await evaluate("document.querySelectorAll('.meal-library-list li').length"), 2);
    if (state === 'empty') assert.match(await evaluate("document.querySelector('.meal-state').textContent"), /아직 식단 기록/);
    if (state === 'loading') assert.equal(await evaluate("document.querySelector('.meal-state').getAttribute('role')"), 'status');
    if (state === 'error') { await evaluate("document.querySelector('.meal-state button').click()"); assert.ok(await evaluate('window.mealRefetches') > 0); }
    if (state === 'partial') assert.match(await evaluate("document.querySelector('.meal-state[role=alert]').textContent"), /현재 목록은 유지/);
    if (state === 'more') { await evaluate("document.querySelector('.meal-more').click()"); await settle(); assert.equal(await evaluate('window.mealMore'), 1); }
    await shot('meal-list-' + state + '-' + width);
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  await evaluate('window.renderMealForm(false)'); await settle();
  await evaluate("document.querySelector('.meal-fields').closest('form').requestSubmit()"); await settle();
  assert.match(await evaluate("document.querySelector('#meal-name-0-error').textContent"), /음식 이름/);
  assert.equal(await evaluate('document.activeElement.id'), 'meal-name-0');
  await evaluate("window.fill('#meal-name-0',' 현미밥 ');window.fill('#meal-amount-0',' 1공기 ');window.fill('#meal-kcal-0','310');document.querySelector('.meal-items > button').click()"); await settle();
  assert.equal(await evaluate("document.querySelectorAll('.meal-item').length"), 2);
  await evaluate("window.fill('#meal-name-1',' 닭가슴살 ');window.fill('#meal-note',' 운동 전 식사 ');document.querySelector('.meal-fields').closest('form').requestSubmit();document.querySelector('.meal-fields').closest('form').requestSubmit()"); await settle();
  assert.equal(await evaluate('window.mealSaves.length'), 1, 'double submit deduplicated');
  assert.equal(await evaluate('window.mealSaves[0].items.length'), 2);
  assert.equal(await evaluate('window.mealSaves[0].items[0].kcal'), 310);
  await evaluate("window.mealSaveReject(new Error('offline'))"); await new Promise(resolve => setTimeout(resolve, 400));
  assert.match(await evaluate("document.querySelector('#meal-test .form-msg').textContent"), /입력 내용은 유지/);
  assert.equal(await evaluate("document.querySelector('#meal-name-0').value"), ' 현미밥 ');
  await shot('meal-create-320');

  for (const width of [1440,375,320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await evaluate("window.renderMealDetail('normal')"); await settle(); await evaluate('document.fonts.ready');
    assert.match(await evaluate("document.querySelector('.meal-detail-summary').textContent"), /490/);
    await shot('meal-detail-' + width);
  }
  await evaluate("document.querySelector('.meal-delete-open').click()"); await settle();
  assert.equal(await evaluate("document.querySelector('.meal-delete-confirm').getAttribute('role')"), 'alertdialog');
  assert.equal(await evaluate("document.activeElement.textContent"), '취소');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await settle();
  assert.equal(await evaluate("!!document.querySelector('.meal-delete-confirm')"), false, 'Escape closes confirmation');
  await evaluate("document.querySelector('.meal-delete-open').click()"); await settle();
  await evaluate("document.querySelector('.meal-delete-button').click();document.querySelector('.meal-delete-button').click()"); await settle();
  assert.equal(await evaluate('window.mealDeletes'), 1, 'delete double click deduplicated');
  await evaluate("window.mealDeleteReject(new Error('offline'))"); await settle();
  assert.match(await evaluate("document.querySelector('.meal-delete-confirm [role=alert]').textContent"), /삭제 결과/);
  await shot('meal-delete-error-320');

  for (const state of ['missing','loading','error']) {
    await evaluate('window.renderMealDetail(' + JSON.stringify(state) + ')'); await settle();
    if (state === 'missing') assert.match(await evaluate("document.querySelector('.meal-state').textContent"), /찾을 수 없/);
    if (state === 'error') { await evaluate("document.querySelector('.meal-state button').click()"); assert.ok(await evaluate('window.mealRefetches') > 1); }
  }
  await evaluate('window.renderMealForm(true)'); await settle();
  assert.equal(await evaluate("document.querySelector('#meal-name-0').value"), '현미밥');
  assert.equal(await evaluate("document.querySelector('.meal-actions .btn').textContent"), '수정 저장하기');
  await shot('meal-edit-320');
  console.log('Meals protected route, parent/sub navigation, list states, pagination, validation, create/edit/delete failure preservation and 320–1440px layouts passed (mock mutations only).');
} finally {
  await fetch('http://127.0.0.1:9223/json/close/' + target.id).catch(() => {});
  socket.close();
}
