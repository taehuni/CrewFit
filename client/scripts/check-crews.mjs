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


async function until(expression) { for(let n=0;n<80;n++){if(await evaluate(expression))return;await wait();}throw new Error('Timeout: '+expression); }
try {
  const session={access_token:'mock-token',refresh_token:'mock-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:'00000000-0000-4000-8000-000000000027',aud:'authenticated',role:'authenticated',email:'test@example.com',app_metadata:{},user_metadata:{}}};
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`{
    localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(session))});
    const original=window.fetch.bind(window), rows=[];
    window.createCalls=0;window.failCreate=false;
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    window.fetch=async(input,init={})=>{
      const url=new URL(typeof input==='string'?input:input.url,location.origin);
      if(url.pathname==='/api/me')return json({profile:{nickname:'테스터'}});
      if(url.pathname==='/rest/v1/regions')return json(url.searchParams.get('offset')==='0' ? [{sido:'서울',sigungu:'마포구'},{sido:'부산',sigungu:'중구'}] : []);
      if(url.pathname==='/rest/v1/crews'){
        if(init.method==='POST'){
          window.createCalls++;await new Promise(r=>setTimeout(r,400));
          if(window.failCreate)return json({message:'mock failure'},500);
          const row={...JSON.parse(init.body),id:15};rows.push(row);return json(row);
        }
        const id=url.searchParams.get('id'); const sport=url.searchParams.get('sport');
        return json(id ? rows.filter(r=>String(r.id)===id.slice(3)) : rows.filter(r=>!sport||r.sport===sport.slice(3)));
      }
      if(url.pathname==='/rest/v1/profiles')return json([{nickname:'테스터'}]);
      if(url.pathname==='/rest/v1/crew_members')return json([{status:'approved'}]);
      if(url.pathname==='/rest/v1/rpc/crew_member_count')return json(1);
      if(url.origin!==location.origin)return json({},503);
      return original(input,init);
    };
  }`});
  await send('Page.navigate',{url:'http://127.0.0.1:5173/crews'});
  await until("document.body.textContent.includes('아직 등록된 크루')");
  await evaluate("document.querySelector('a[href=\"/crews/new\"]').click()");
  await until("Array.from(document.querySelectorAll('.crew-form option')).some(o=>o.value==='서울')");
  await evaluate(`{
    function set(el,value){Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}
    set(document.querySelector('input[name=name]'),'테스트 러닝 크루');
    set(document.querySelectorAll('.crew-form select')[2],'서울');
  }`);
  await wait();
  await evaluate(`{const el=document.querySelectorAll('.crew-form select')[3];Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'마포구');el.dispatchEvent(new Event('change',{bubbles:true}));}`);
  for(const width of [1440,375,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await wait();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  }
  await evaluate("window.failCreate=true; document.querySelector('form').requestSubmit()");
  await until("!!document.querySelector('.crew-error')");
  assert.equal(await evaluate("document.querySelector('input[name=name]').value"),'테스트 러닝 크루');
  await evaluate("window.failCreate=false; document.querySelector('form').requestSubmit();document.querySelector('form').requestSubmit()");
  await until("!!document.querySelector('.crew-detail-hero')");
  assert.equal(await evaluate('createCalls'),2);
  assert.match(await evaluate("document.querySelector('.crew-detail-hero').textContent"),/테스트 러닝 크루/);
  assert.match(await evaluate("document.querySelector('.crew-detail-body').textContent"),/크루장/);
  await evaluate("document.querySelector('.crews-heading a').click()");
  await until("!!document.querySelector('.crew-card')");
  await evaluate("Array.from(document.querySelectorAll('.crew-sports button')).find(b=>b.textContent==='헬스').click()");
  await until("document.body.textContent.includes('아직 등록된 크루')");
  console.log('Crew list/create/detail, owner status, failed-submit preservation, double submit, sport filter and 320–1440px passed (mock API).');
} finally { await fetch('http://127.0.0.1:9223/json/close/'+tab.id).catch(()=>{});socket.close(); }
