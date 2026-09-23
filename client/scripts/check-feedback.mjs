import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const env = Object.fromEntries((await readFile(new URL('../.env', import.meta.url), 'utf8')).split(/\r?\n/)
  .map(line => line.match(/^([^#=]+)=(.*)$/)).filter(Boolean).map(match => [match[1], match[2]]));
const project = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const storageKey = `sb-${project}-auth-token`;
const tab = await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' }).then(response => response.json());
const socket = new WebSocket(tab.webSocketDebuggerUrl);
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
const wait = () => new Promise(resolve => setTimeout(resolve, 150));

try {
  await send('Page.enable'); await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await wait();
  const session = { access_token: 'mock-token', refresh_token: 'mock-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer', user: { id: '00000000-0000-4000-8000-000000000027', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {} } };
  await evaluate(`localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(session))})`);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `{
    const originalFetch = window.fetch.bind(window);
    window.feedbackCalls = []; window.feedbackFailure = false;
    const saved = new Map(); const history = [];
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/rest/v1/ai_feedback_history')) {
        const cursor = new URL(url).searchParams.get('id');
        const rows = history.filter(row => !cursor || row.id < Number(cursor.slice(3))).slice(0,20);
        return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
      }
      if (url.includes('/rest/v1/ai_feedbacks')) {
        const params = new URL(url).searchParams;
        const row = saved.get(params.get('period').slice(3));
        return new Response(JSON.stringify(row ? [row] : []), {status:200,headers:{'Content-Type':'application/json'}});
      }
      if (url.includes('/api/feedback/generate')) {
        const body = JSON.parse(init.body); window.feedbackCalls.push(body);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (window.feedbackFailure) return new Response(JSON.stringify({error:{code:'LLM_FAILED',message:'테스트 생성 실패'}}),{status:502,headers:{'Content-Type':'application/json'}});
        const row = {id:12,period:body.period,period_start:body.date,content:'① 현재 상태\\n헬스 1회, 30분입니다.\\n\\n④ 다음 행동\\n세트별 중량과 횟수를 기록하세요.',model:'gpt-4.1-mini',created_at:'2026-09-21T04:20:00Z',cached:false,regen_count:body.force ? 1 : 0,remaining_regenerations:body.force ? 2 : 3};
        saved.set(body.period, row);
        history.unshift({...row,id:history.length+1,content:row.content+' 이력 '+(history.length+1)});
        return new Response(JSON.stringify(row),{status:200,headers:{'Content-Type':'application/json'}});
      }
      if (url.includes('/api/me')) return Promise.resolve(new Response(JSON.stringify({profile:{nickname:'러닝메이트'}}),{status:200,headers:{'Content-Type':'application/json'}}));
      if (new URL(url, location.origin).origin !== location.origin) return new Response('{}', {status:503});
      return originalFetch(input, init);
    };
  }` });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/feedback' });
  for (let n = 0; n < 80; n++) { if (await evaluate("!!document.querySelector('.feedback-actions .btn-primary:not(:disabled)')")) break; await wait(); }
  assert.equal(await evaluate('location.pathname'), '/feedback');
  assert.equal(await evaluate('feedbackCalls.length'), 0);
  assert.equal(await evaluate("document.querySelector('.ws-nav-item[aria-current=page] span').textContent"), '홈');
  assert.equal(await evaluate("document.querySelector('.feedback-periods [aria-pressed=true]').textContent"), '한 주');
  await evaluate("document.querySelectorAll('.feedback-periods button')[2].click()");
  for (let n = 0; n < 40; n++) { if (await evaluate("!!document.querySelector('.feedback-actions .btn-primary:not(:disabled)')")) break; await wait(); }
  assert.equal(await evaluate('feedbackCalls.length'), 0);
  await evaluate("{const b=document.querySelector('.feedback-actions .btn-primary'); b.click(); b.click();}");
  await wait();
  assert.equal(await evaluate('feedbackCalls.length'), 1);
  assert.equal(await evaluate("document.querySelector('.feedback-periods button').disabled"), true);
  for (let n = 0; n < 40; n++) { if (await evaluate("!!document.querySelector('.feedback-content')")) break; await wait(); }
  assert.match(await evaluate("document.querySelector('.feedback-content').textContent"), /다음 행동/);
  assert.deepEqual(await evaluate('feedbackCalls.map(c=>[c.period,c.force])'), [['month',false]]);
  for (const width of [1440, 375, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 }); await wait();
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    assert.equal(await evaluate("document.querySelectorAll('.feedback-page h1').length"), 1);
  }
  await evaluate("document.querySelector('.feedback-periods button').click()"); await wait();
  assert.equal(await evaluate("document.querySelector('.feedback-periods [aria-pressed=true]').textContent"), '하루');
  assert.equal(await evaluate('feedbackCalls.length'), 1);
  assert.equal(await evaluate("!!document.querySelector('.feedback-content')"), false);
  await evaluate("document.querySelectorAll('.feedback-periods button')[2].click()"); await wait();
  assert.equal(await evaluate('feedbackCalls.length'), 1);
  assert.match(await evaluate("document.querySelector('.feedback-content').textContent"), /다음 행동/);
  await evaluate("window.feedbackFailure=true; document.querySelector('footer.feedback-actions button').click()");
  for (let n = 0; n < 40; n++) { if (await evaluate("!!document.querySelector('.feedback-regenerate-error')")) break; await wait(); }
  assert.match(await evaluate("document.querySelector('.feedback-regenerate-error').textContent"), /기존 코칭은 그대로/);
  assert.match(await evaluate("document.querySelector('.feedback-content').textContent"), /다음 행동/);
  assert.equal(await evaluate('feedbackCalls[1].force'), true);
  await evaluate("window.feedbackFailure=false; document.querySelector('footer.feedback-actions button').click()");
  for (let n = 0; n < 40; n++) { if (await evaluate("document.querySelector('footer.feedback-actions button').textContent.includes('2회')")) break; await wait(); }
  assert.equal(await evaluate('feedbackCalls.length'), 3);
  assert.match(await evaluate("document.querySelector('footer.feedback-actions button').textContent"), /2회/);
  for (let n=0;n<40;n++) { if(await evaluate("document.querySelectorAll('.feedback-history-item').length===2")) break; await wait(); }
  assert.equal(await evaluate("document.querySelectorAll('.feedback-history-item').length"),2);
  await evaluate("document.querySelectorAll('.feedback-history-item summary')[1].click()");
  assert.match(await evaluate("document.querySelector('.feedback-history-item[open] .feedback-history-content').textContent"),/이력 1/);
  assert.equal(await evaluate('feedbackCalls.length'),3);
  console.log('Passed: no automatic generation, explicit month request, double-click lock, saved-result switching, failed/successful regeneration and 320–1440px layouts. Mocked API only.');
} finally {
  await fetch('http://127.0.0.1:9223/json/close/' + tab.id).catch(() => {}); socket.close();
}
