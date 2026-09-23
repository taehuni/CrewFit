// Real app + SDK, mocked Auth HTTP only: no account creation or email sending.
import assert from 'node:assert/strict';
const target = await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let seq = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const msg = JSON.parse(event.data), job = pending.get(msg.id);
  if (!job) return;
  pending.delete(msg.id); clearTimeout(job.timer);
  msg.error ? job.reject(new Error(JSON.stringify(msg.error))) : job.resolve(msg.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq, timer = setTimeout(() => reject(new Error(method + ' timeout')), 15000);
  pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function until(expression) {
  for (let n = 0; n < 100; n++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Not ready: ' + expression + ' / ' + await evaluate('document.body.innerText'));
}
async function go(path) {
  await send('Page.navigate', { url: 'http://127.0.0.1:5173' + path });
  await until("!!document.querySelector('.auth-heading')");
}
try {
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.clear();
    window.authCalls=[];window.authMode='ok';
    const originalFetch=window.fetch.bind(window);
    const mockUser={id:'00000000-0000-4000-8000-000000000027',email:'test@example.com',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-09-21T00:00:00Z',app_metadata:{},user_metadata:{}};
    window.fetch=async(input,init={})=>{
      const url=new URL(typeof input==='string'?input:input.url,location.origin);
      if(url.pathname.startsWith('/auth/v1/')){
        window.authCalls.push({path:url.pathname,body:init.body?JSON.parse(init.body):null,redirect:url.searchParams.get('redirect_to')});
        if(window.authMode==='offline')throw new TypeError('mock offline');
        const fail=window.authMode==='rate'||url.pathname.endsWith('/token');
        const data=window.authMode==='rate'?{code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'}:url.pathname.endsWith('/token')?{code:'email_not_confirmed',msg:'Email not confirmed'}:url.pathname.endsWith('/signup')?{user:mockUser,session:null}:url.pathname.endsWith('/user')?mockUser:{};
        return new Response(JSON.stringify(data),{status:fail?(window.authMode==='rate'?429:400):200,headers:{'Content-Type':'application/json'}});
      }
      if(url.origin!==location.origin)return new Response('{}',{status:503});
      return originalFetch(input,init);
    };
    window.fill=(id,value)=>{const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
  ` });
  await go('/signup');
  await evaluate("fill('nickname','테스트');fill('real-name','테스트이름');fill('email','test@example.com');fill('password','test-password');document.querySelector('form').requestSubmit();document.querySelector('form').requestSubmit()");
  await until("location.pathname==='/verify-email' && !!document.querySelector('#confirmation-email')");
  assert.equal(await evaluate("authCalls.filter(x=>x.path.endsWith('/signup')).length"), 1);
  assert.equal(await evaluate("authCalls.find(x=>x.path.endsWith('/signup')).redirect"), 'http://127.0.0.1:5173/auth/callback');
  assert.equal(await evaluate("document.querySelector('#confirmation-email').value"), 'test@example.com');
  assert.equal(await evaluate("document.querySelector('form button').disabled"), true);
  assert.doesNotMatch(await evaluate('document.body.innerText'), /로그인 세션이 없/);
  for (const width of [1440, 375, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  }
  await go('/#error=access_denied&error_code=otp_expired&error_description=private-error');
  await until("location.pathname==='/auth/callback' && location.hash===''");
  assert.match(await evaluate('document.body.innerText'), /만료/);
  assert.doesNotMatch(await evaluate('document.body.innerText'), /private-error/);
  await evaluate("fill('confirmation-email','test@example.com')");
  await evaluate("document.querySelector('form').requestSubmit();document.querySelector('form').requestSubmit()");
  await until("document.querySelector('form button').disabled");
  assert.equal(await evaluate("authCalls.filter(x=>x.path.endsWith('/resend')).length"), 1);
  assert.equal(await evaluate("authCalls.find(x=>x.path.endsWith('/resend')).body.type"), 'signup');
  assert.equal(await evaluate("authCalls.find(x=>x.path.endsWith('/resend')).redirect"), 'http://127.0.0.1:5173/auth/callback');
  await go('/verify-email');
  await evaluate("window.authMode='rate';fill('confirmation-email','test@example.com')");
  await evaluate("document.querySelector('form').requestSubmit()");
  await until("document.querySelector('[role=alert]').textContent.includes('요청이 너무 잦')");
  assert.equal(await evaluate("document.querySelector('#confirmation-email').value"), 'test@example.com');
  await go('/login');
  await evaluate("fill('email','test@example.com');fill('password','test-password');document.querySelector('form').requestSubmit()");
  await until("!!document.querySelector('a[href=\"/verify-email\"]')");
  const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'), Buffer.from(JSON.stringify({sub:'00000000-0000-4000-8000-000000000027',aud:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'), 'mock'].join('.');
  for (const path of ['/auth/callback', '/']) {
    await go(path + '#access_token=' + token + '&refresh_token=mock-refresh&expires_in=3600&token_type=bearer&type=signup');
    await until("document.querySelector('h1').textContent==='이메일 인증이 완료됐어요'");
    assert.equal(await evaluate('location.hash'), '');
    assert.equal(await evaluate("document.querySelector('a[href=\"/home\"]').textContent"), '내 운동으로');
  }
  await go('/#access_token=' + token + '&refresh_token=mock-refresh&expires_in=3600&token_type=bearer&type=recovery');
  await until("location.pathname==='/reset-password' && !!document.querySelector('#confirm')");
  console.log('Signup wait, double submit, resend/cooldown/rate limit, unconfirmed login, old/new callback success/error, recovery routing, 320–1440px passed; no real Auth requests.');
} finally {
  await fetch('http://127.0.0.1:9223/json/close/' + target.id).catch(() => {});
  socket.close();
}
