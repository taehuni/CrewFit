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
  await send('Fetch.enable',{patterns:[{urlPattern:'*/storage/v1/object/sign/post-images/*',resourceType:'Image',requestStage:'Request'}]});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Fetch.requestPaused')void send('Fetch.fulfillRequest',{requestId:message.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII='});});
  const session={access_token:'mock-token',refresh_token:'mock-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:'00000000-0000-4000-8000-000000000027',aud:'authenticated',role:'authenticated',email:'test@example.com',app_metadata:{},user_metadata:{}}};
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`{
    localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(session))});
    const original=window.fetch.bind(window), rows=[];
    window.createCalls=0;window.failCreate=false;window.crewFixtures=rows;window.membership=null;window.joinCalls=0;window.leaveCalls=0;
    window.managed=[{user_id:'00000000-0000-4000-8000-000000000028',status:'pending',can_post:false}];
    window.preferences={profile:{nickname:'테스터',main_sport:null,level:null},settings:{preferred_days:[]}};
    window.matchMode='normal';
    window.statsMode='normal';
    window.posts=[];window.postWrites=0;window.failPost=false;window.allowPost=false;
    window.photoUploads=0;window.failUpload=false;window.denyPhoto=false;
    window.comments=[];window.likes=[];window.commentWrites=0;window.likeWrites=0;window.failComment=false;
    window.pinWrites=0;window.failPin=false;
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    window.fetch=async(input,init={})=>{
      const url=new URL(typeof input==='string'?input:input.url,location.origin);
      if(url.pathname==='/api/me')return json(window.preferences);
      if(url.pathname==='/rest/v1/post_likes'){
        const caller='00000000-0000-4000-8000-000000000027';
        if(init.method==='POST'){likeWrites++;if(!likes.length)likes.push({user_id:caller,profiles:{nickname:'테스터'}});return json(null);}
        if(init.method==='DELETE'){window.likes=[];return json(null);}
        if(init.method==='HEAD')return new Response(null,{status:200,headers:{'Content-Range':'0-0/'+likes.length}});
        return json(url.searchParams.get('user_id')?.startsWith('gt.')?[]:likes);
      }
      if(url.pathname==='/rest/v1/comments'){
        if(init.method==='POST'){commentWrites++;await new Promise(r=>setTimeout(r,250));if(failComment)return json({message:'mock failure'},500);const row={...JSON.parse(init.body),id:1,created_at:'2026-09-25T12:00:00Z',updated_at:'stamp',profiles:{nickname:'테스터'}};comments.push(row);return json([{id:1}]);}
        if(init.method==='PATCH'){Object.assign(comments[0],JSON.parse(init.body));return json([{id:1}]);}
        if(init.method==='DELETE'){window.comments=[];return json([{id:1}]);}
        return json(url.searchParams.get('id')?.startsWith('gt.')?[]:comments);
      }
      if(url.pathname==='/rest/v1/activities'){
        const rows=[{id:7,user_id:'00000000-0000-4000-8000-000000000027',sport:'gym',performed_on:'2026-09-25',duration_sec:1800,distance_m:null},{id:8,user_id:'00000000-0000-4000-8000-000000000027',sport:'running',performed_on:'2026-09-24',duration_sec:1500,distance_m:5000}];
        const id=url.searchParams.get('id');return json(id?.startsWith('eq.')?rows.filter(row=>String(row.id)===id.slice(3)):id?.startsWith('lt.')?[]:rows);
      }
      if(url.pathname==='/rest/v1/exercise_sets')return json(url.searchParams.has('id')?[]:[{id:1,exercise_name:'스쿼트',set_no:1,reps:10,weight_kg:60},{id:2,exercise_name:'스쿼트',set_no:2,reps:8,weight_kg:60}]);
      if(url.pathname.startsWith('/storage/v1/object/post-images/')){photoUploads++;return failUpload?json({message:'upload failed',statusCode:500,error:'failed'},500):json({Key:'post-images/test',Id:'test'});}
      if(url.pathname==='/storage/v1/object/sign/post-images')return json(JSON.parse(init.body).paths.map(path=>({path,error:denyPhoto?'denied':null,signedURL:denyPhoto?null:'/object/sign/post-images/'+path+'?token=mock'})));
      if(url.pathname==='/rest/v1/rpc/can_post_in_crew')return json(window.allowPost);
      if(url.pathname==='/rest/v1/rpc/is_crew_owner')return json(true);
      if(url.pathname==='/rest/v1/posts'){
        if(init.method==='POST'){
          postWrites++;await new Promise(r=>setTimeout(r,250));
          if(failPost)return json({message:'mock failure'},500);
          const row={...JSON.parse(init.body),id:101,created_at:'2026-09-25T12:00:00Z',updated_at:'2026-09-25T12:00:00Z',profiles:{nickname:'테스터'},crews:null};posts.push(row);return json([{id:row.id}]);
        }
        const id=url.searchParams.get('id');let found=posts.filter(row=>!id||String(row.id)===id.slice(3));
        if(init.method==='PATCH'){const patch=JSON.parse(init.body);if('is_pinned' in patch){pinWrites++;await new Promise(r=>setTimeout(r,250));if(failPin)return json({message:'denied'},403);}Object.assign(found[0],patch);return json([{id:found[0].id}]);}
        if(init.method==='DELETE'){window.posts=posts.filter(row=>!found.includes(row));return json(found.map(row=>({id:row.id})));}
        if(url.searchParams.get('visibility')==='eq.public')found=found.filter(row=>row.visibility==='public');
        const crew=url.searchParams.get('crew_id');if(crew)found=found.filter(row=>String(row.crew_id)===crew.slice(3));
        const kind=url.searchParams.get('kind');if(kind?.startsWith('eq.'))found=found.filter(row=>row.kind===kind.slice(3));
        const cursor=url.searchParams.get('id');if(cursor?.startsWith('lt.'))found=[];
        if(!id?.startsWith('eq.'))found.sort((a,b)=>(url.searchParams.get('order')?.startsWith('is_pinned')?Number(b.is_pinned)-Number(a.is_pinned):0)||b.id-a.id);
        return json(found);
      }
      if(url.pathname.startsWith('/api/crews/') && url.pathname.endsWith('/stats')){
        if(statsMode==='error')return json({error:{code:'STATS_FAILED',message:'통계 테스트 실패'}},500);
        if(url.searchParams.get('period')==='week')return json({hidden:true,reason:'MIN_MEMBERS'});
        return json({period:'month',period_start:'2026-09-01',period_end:'2026-09-30',activity_count:12,distance_m:42000,duration_sec:10800,contributing_members:3});
      }
      if(url.pathname==='/api/crews/match'){
        if(!preferences.profile.main_sport)return json({error:{code:'SETTINGS_REQUIRED',message:'주종목 필요'}},400);
        if(matchMode==='error')return json({error:{code:'MATCH_FAILED',message:'mock failure'}},500);
        return json({crews:matchMode==='empty'?[]:[{id:90,name:'추천 검증 크루',sport:preferences.profile.main_sport,region_sido:'서울',region_sigungu:'마포구',activity_days:[1],level:null,join_mode:'open',member_count:3,matched_on:['sport','region','days']}],relaxed:['level']});
      }
      if(url.pathname==='/rest/v1/profiles' && init.method==='PATCH'){Object.assign(preferences.profile,JSON.parse(init.body));return json({id:'self'});}
      if(url.pathname==='/rest/v1/user_settings' && init.method==='PATCH'){Object.assign(preferences.settings,JSON.parse(init.body));return json({user_id:'self'});}
      if(url.pathname==='/api/crews/15/approve'){window.managed[0].status='approved';return json({ok:true});}
      if(url.pathname==='/api/crews/20/join'){
        window.joinCalls++;await new Promise(r=>setTimeout(r,400));
        window.membership=rows.find(r=>r.id===20).join_mode==='open'?'approved':'pending';return json({status:window.membership});
      }
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
      if(url.pathname==='/rest/v1/profiles')return json([{id:'00000000-0000-4000-8000-000000000028',nickname:'신청자'}]);
      if(url.pathname==='/rest/v1/rpc/crew_member_names')return json(window.managed.filter(m=>m.status==='approved').map(m=>({user_id:m.user_id,real_name:'테스트실명'})));
      if(url.pathname==='/rest/v1/crew_members'){
        if(url.searchParams.get('crew_id')==='eq.15' && url.searchParams.get('select')!=='status'){
          if(init.method==='PATCH')window.managed[0].can_post=JSON.parse(init.body).can_post;
          if(init.method==='DELETE'){window.managed=[];return json([{user_id:'removed'}]);}
          return json(window.managed);
        }
        if(init.method==='DELETE'){window.leaveCalls++;window.membership=null;return json([{user_id:'self'}]);}
        return json(url.searchParams.get('crew_id')==='eq.20' ? (window.membership?[{status:window.membership}]:[]) : [{status:'approved'}]);
      }
      if(url.pathname==='/rest/v1/rpc/crew_member_count')return json(window.membership==='approved'?2:1);
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
  await until("!!document.querySelector('.crew-stats-hidden')");
  assert.equal(await evaluate("document.querySelectorAll('.crew-stats-totals').length"),0);
  await evaluate("Array.from(document.querySelectorAll('.crew-stats button')).find(b=>b.textContent==='이번 달').click()");
  await until("!!document.querySelector('.crew-stats-totals')");
  assert.match(await evaluate("document.querySelector('.crew-stats').textContent"),/크루원 3명/);
  assert.match(await evaluate("document.querySelector('.crew-stats-totals').textContent"),/42/);
  for(const width of [1440,375,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await wait();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  }
  await evaluate("statsMode='error';Array.from(document.querySelectorAll('.crew-stats button')).find(b=>b.textContent==='새로고침').click()");
  await until("!!document.querySelector('.crew-stats [role=alert]')");
  assert.equal(await evaluate("document.querySelectorAll('.crew-stats-totals').length"),0);
  await evaluate("statsMode='normal';Array.from(document.querySelectorAll('.crew-stats button')).find(b=>b.textContent==='이번 주').click()");
  await until("!!document.querySelector('.crew-stats-hidden')");
  await until("document.querySelector('.crew-management')?.textContent.includes('신청자')");
  assert.ok(!(await evaluate("document.querySelector('.crew-management').textContent")).includes('테스트실명'));
  await evaluate("Array.from(document.querySelectorAll('.crew-management button')).find(b=>b.textContent==='승인').click()");
  await until("document.querySelector('.crew-management')?.textContent.includes('테스트실명')");
  await evaluate("document.querySelector('.crew-management button[aria-pressed]').click()");
  await until("document.querySelector('.crew-management button[aria-pressed]')?.getAttribute('aria-pressed')==='true'");
  for(const width of [1440,375,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await wait();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  }
  await evaluate("Array.from(document.querySelectorAll('.crew-management button')).find(b=>b.textContent==='내보내기').click()");
  await until("!!document.querySelector('.crew-management .crew-leave-confirm')");
  assert.equal(await evaluate('managed.length'),1);
  await evaluate("document.querySelector('.crew-management .crew-leave-confirm .btn-primary').click()");
  await until("managed.length===0 && !document.querySelector('.crew-management').textContent.includes('테스트실명')");
  await evaluate("document.querySelector('.crews-heading a').click()");
  await until("!!document.querySelector('.crew-card')");
  await evaluate("Array.from(document.querySelectorAll('.crew-sports button')).find(b=>b.textContent==='헬스').click()");
  await until("document.body.textContent.includes('아직 등록된 크루')");
  await evaluate(`crewFixtures.push({id:20,owner_id:'other',name:'가입 테스트',sport:'gym',region_sido:'서울',region_sigungu:'마포구',activity_days:[1,3],join_mode:'open'});history.pushState({},'', '/crews/20');dispatchEvent(new PopStateEvent('popstate'));`);
  await until("document.querySelector('.crew-membership button')?.textContent==='크루 가입하기'");
  await evaluate("{const b=document.querySelector('.crew-membership button');b.click();b.click();}");
  await until("document.querySelector('.crew-membership button')?.textContent==='크루 탈퇴'");
  assert.equal(await evaluate('joinCalls'),1);
  await evaluate("document.querySelector('.crew-membership button').click()");
  await until("!!document.querySelector('.crew-leave-confirm')");
  assert.equal(await evaluate('leaveCalls'),0);
  await evaluate("document.querySelector('.crew-leave-confirm .btn-ghost').click()");
  assert.equal(await evaluate('leaveCalls'),0);
  await evaluate("document.querySelector('.crew-membership button').click()");await wait();
  await evaluate("document.querySelector('.crew-leave-confirm .btn-primary').click()");
  await until("document.querySelector('.crew-membership button')?.textContent==='크루 가입하기'");
  assert.equal(await evaluate('leaveCalls'),1);
  await evaluate("crewFixtures.find(r=>r.id===20).join_mode='approval';document.querySelector('.crews-heading a').click()");
  await until("!!document.querySelector('a[href=\"/crews/20\"]')");
  await evaluate("document.querySelector('a[href=\"/crews/20\"]').click()");
  await until("document.querySelector('.crew-membership button')?.textContent==='가입 요청하기'");
  await evaluate("document.querySelector('.crew-membership button').click()");
  await until("document.querySelector('.crew-membership button')?.textContent==='가입 요청 취소'");
  await evaluate("document.querySelector('.crew-membership button').click()");await wait();
  await evaluate("document.querySelector('.crew-leave-confirm .btn-primary').click()");
  await until("document.querySelector('.crew-membership button')?.textContent==='가입 요청하기'");
  assert.equal(await evaluate('leaveCalls'),2);
  await evaluate("history.pushState({},'', '/crews');dispatchEvent(new PopStateEvent('popstate'));");
  await until("document.querySelector('.crew-recommendations')?.textContent.includes('주종목 설정하기')");
  await evaluate("document.querySelector('.crew-recommendations a[href=\"/me#crew-preferences\"]').click()");
  await until("!!document.querySelector('#crew-preferences select:not(:disabled)')");
  await evaluate(`{
    const el=document.querySelector('#crew-preferences select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'gym');el.dispatchEvent(new Event('change',{bubbles:true}));
  }`);await wait();
  for(const width of [1440,375,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await wait();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  }
  await evaluate("document.querySelector('#crew-preferences form').requestSubmit()");
  await until("document.querySelector('#crew-preferences')?.textContent.includes('추천 설정을 저장했어요')");
  assert.equal(await evaluate('preferences.profile.main_sport'),'gym');
  await evaluate("history.pushState({},'', '/crews');dispatchEvent(new PopStateEvent('popstate'));");
  await until("document.querySelector('.crew-recommendations')?.textContent.includes('추천 검증 크루')");
  assert.match(await evaluate("document.querySelector('.crew-recommendations').textContent"),/레벨 조건을 넓혔어요/);
  for(const width of [1440,375,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await wait();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  }
  for(const [mode,expected] of [['error','추천을 불러오지 못했어요'],['empty','아직 추천할 크루가 없어요']]){
    await evaluate(`matchMode='${mode}';history.pushState({},'', '/me');dispatchEvent(new PopStateEvent('popstate'));`);
    await until("!!document.querySelector('#crew-preferences')");
    await evaluate("history.pushState({},'', '/crews');dispatchEvent(new PopStateEvent('popstate'));");
    await until(`document.querySelector('.crew-recommendations')?.textContent.includes('${expected}')`);
  }
  console.log('Passed: recommendation setup/save/navigation, relaxed reasons, error/empty states, 320–1440px (mock API).');
  await evaluate("history.pushState({},'', '/feed');dispatchEvent(new PopStateEvent('popstate'));");
  await until("!!document.querySelector('.feed-empty')");
  await evaluate("document.querySelector('a[href=\"/feed/new\"]').click()");
  await until("!!document.querySelector('.post-form textarea')");
  await evaluate(`{const el=document.querySelector('.post-form textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'오늘 운동 이야기');el.dispatchEvent(new Event('input',{bubbles:true}));}`);await wait();
  await until("!!document.querySelector('.activity-picker option[value=\"7\"]')");
  await evaluate(`{const el=document.querySelector('.activity-picker select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'7');el.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await until("document.querySelector('select[name=kind]')?.value==='log'");
  assert.match(await evaluate("document.querySelector('.activity-picker').textContent"),/메모·세트 포함/);
  await evaluate(`{const transfer=new DataTransfer();transfer.items.add(new File(['bad'],'bad.svg',{type:'image/svg+xml'}));const el=document.querySelector('input[type=file]');el.files=transfer.files;el.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await until("document.querySelector('.post-form [role=alert]')?.textContent.includes('JPG')");
  await evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle='#ff4f0f';ctx.fillRect(0,0,32,32);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const transfer=new DataTransfer();transfer.items.add(new File([blob],'test.png',{type:'image/png'}));const el=document.querySelector('input[type=file]');el.files=transfer.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until("document.querySelector('.post-photo-editor img')?.naturalWidth===32");
  await evaluate("failUpload=true;document.querySelector('.post-form').requestSubmit()");
  await until("document.querySelector('.post-form [role=alert]')?.textContent.includes('사진 업로드')");
  assert.equal(await evaluate('postWrites'),0);
  await evaluate('failUpload=false');
  for(const width of [1440,375,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await wait();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  }
  await evaluate("failPost=true;document.querySelector('.post-form').requestSubmit()");
  await until("!!document.querySelector('.post-form [role=alert]')");
  assert.equal(await evaluate("document.querySelector('textarea').value"),'오늘 운동 이야기');
  await evaluate("failPost=false;document.querySelector('.post-form').requestSubmit();document.querySelector('.post-form').requestSubmit()");
  await until("!!document.querySelector('.post-content')");
  assert.equal(await evaluate('postWrites'),2);
  assert.equal(await evaluate('photoUploads'),2); // One failed upload, one success; retry post reuses uploaded path.
  await until("document.querySelector('.post-activity')?.textContent.includes('스쿼트')");
  assert.match(await evaluate("document.querySelector('.post-activity').textContent"),/10회 · 60 kg/);
  assert.equal(await evaluate('posts[0].include_route'),false);
  await until("document.querySelector('.feed-post img')?.naturalWidth>0");
  await evaluate("document.querySelector('.feed-heading a').click()");
  await until("document.querySelector('.feed-list img')?.naturalWidth>0");
  await evaluate("denyPhoto=true;document.querySelector('.feed-preview').click()");
  await until("!!document.querySelector('.post-image-state button')");
  assert.equal(await evaluate("document.querySelectorAll('.feed-post img').length"),0);
  await evaluate("denyPhoto=false;document.querySelector('.post-image-state button').click()");
  await until("document.querySelector('.feed-post img')?.naturalWidth>0");
  await evaluate("document.querySelector('a[href=\"/feed/101/edit\"]').click()");
  await until("!!document.querySelector('.post-form textarea')");
  await evaluate(`{const el=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'수정한 운동 이야기');el.dispatchEvent(new Event('input',{bubbles:true}));}`);await wait();
  await evaluate("document.querySelector('.post-form').requestSubmit()");
  await until("document.querySelector('.post-content')?.textContent==='수정한 운동 이야기'");
  await until("document.querySelector('.feed-post img')?.naturalWidth>0");
  await evaluate("document.querySelector('a[href=\"/feed/101/edit\"]').click()");
  await until("!!document.querySelector('.post-photo-editor button')");
  await until("!!document.querySelector('.activity-picker option[value=\"8\"]')");
  await evaluate(`{const el=document.querySelector('.activity-picker select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'8');el.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await evaluate("Array.from(document.querySelectorAll('.post-photo-editor button')).find(b=>b.textContent==='사진 제거').click()");
  await evaluate("document.querySelector('.post-form').requestSubmit()");
  await until("!!document.querySelector('.post-content') && !document.querySelector('.feed-post img')");
  assert.equal(await evaluate('posts[0].image_path'),null);
  await until("document.querySelector('.post-activity')?.textContent.includes('5 km')");
  await evaluate("document.querySelector('a[href=\"/feed/101/edit\"]').click()");
  await until("!!document.querySelector('.activity-picker select')");
  await evaluate(`{const el=document.querySelector('.activity-picker select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'');el.dispatchEvent(new Event('change',{bubbles:true}));}`);await wait();
  await evaluate("document.querySelector('.post-form').requestSubmit()");
  await until("!!document.querySelector('.post-content') && !document.querySelector('.post-activity')");
  assert.equal(await evaluate('posts[0].activity_id'),null);
  await until("!!document.querySelector('.like-toggle:not(:disabled)')");
  await evaluate("document.querySelector('.like-toggle').click();document.querySelector('.like-toggle').click()");
  await until("document.querySelector('.like-toggle')?.getAttribute('aria-pressed')==='true'");
  assert.equal(await evaluate('likeWrites'),1);
  await evaluate("Array.from(document.querySelectorAll('.post-interactions button')).find(b=>b.textContent==='좋아요한 회원').click()");
  await until("document.querySelector('.post-likers')?.textContent.includes('테스터')");
  await evaluate("document.querySelector('.like-toggle').click()");
  await until("document.querySelector('.like-toggle')?.getAttribute('aria-pressed')==='false'");
  await evaluate(`{const el=document.querySelector('#new-comment');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'좋은 운동이네요');el.dispatchEvent(new Event('input',{bubbles:true}));}`);await wait();
  await evaluate("failComment=true;document.querySelector('.comment-form').requestSubmit()");
  await until("!!document.querySelector('.post-interactions .feed-error')");
  assert.equal(await evaluate("document.querySelector('#new-comment').value"),'좋은 운동이네요');
  await evaluate("failComment=false;document.querySelector('.comment-form').requestSubmit();document.querySelector('.comment-form').requestSubmit()");
  await until("document.querySelector('.comment-content')?.textContent==='좋은 운동이네요'");
  assert.equal(await evaluate('commentWrites'),2);
  await evaluate("Array.from(document.querySelectorAll('.comment-list button')).find(b=>b.textContent==='댓글 수정').click()");
  await until("!!document.querySelector('.comment-edit textarea')");
  await evaluate(`{const el=document.querySelector('.comment-edit textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'수정한 댓글');el.dispatchEvent(new Event('input',{bubbles:true}));}`);await wait();
  await evaluate("document.querySelector('.comment-edit').requestSubmit()");
  await until("document.querySelector('.comment-content')?.textContent==='수정한 댓글'");
  await evaluate("Array.from(document.querySelectorAll('.comment-list button')).find(b=>b.textContent==='댓글 삭제').click()");
  await until("!!document.querySelector('.comment-confirm')");
  await evaluate("document.querySelector('.comment-confirm .btn-ghost').click()");
  assert.equal(await evaluate('comments.length'),1);
  await evaluate("Array.from(document.querySelectorAll('.comment-list button')).find(b=>b.textContent==='댓글 삭제').click()");await wait();
  await evaluate("document.querySelector('.comment-confirm .btn-primary').click()");
  await until("comments.length===0 && !document.querySelector('.comment-content')");
  await evaluate("document.querySelector('.feed-actions button').click()");
  await until("!!document.querySelector('.post-confirm')");
  assert.equal(await evaluate('posts.length'),1);
  await evaluate("document.querySelector('.post-confirm .btn-ghost').click()");
  assert.equal(await evaluate('posts.length'),1);
  await evaluate("document.querySelector('.feed-actions button').click()");await wait();
  await evaluate("document.querySelector('.post-confirm .btn-primary').click()");
  await until("!!document.querySelector('.feed-empty')");assert.equal(await evaluate('posts.length'),0);
  await evaluate("history.pushState({},'', '/feed/new?crew=20');dispatchEvent(new PopStateEvent('popstate'));");
  await until("document.body.textContent.includes('크루 글 작성 권한이 없어요')");
  await evaluate("allowPost=true;history.pushState({},'', '/feed?crew=20');dispatchEvent(new PopStateEvent('popstate'));");
  await until("!!document.querySelector('a[href=\"/feed/new?crew=20\"]')");
  await evaluate("document.querySelector('a[href=\"/feed/new?crew=20\"]').click()");
  await until("!!document.querySelector('.post-form')");
  assert.equal(await evaluate("document.querySelector('select[name=visibility]').value"),'crew');
  await evaluate(`{const el=document.querySelector('select[name=visibility]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'public');el.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await until("document.body.textContent.includes('크루 밖 회원도 전체 피드에서')");
  await evaluate("history.pushState({},'', '/feed/999/edit');dispatchEvent(new PopStateEvent('popstate'));");
  await until("document.body.textContent.includes('글이 없거나 수정할 수 없어요')");
  await evaluate(`{
    const base={author_id:'00000000-0000-4000-8000-000000000027',crew_id:15,visibility:'public',kind:'free',content:'크루장 알림',is_pinned:false,created_at:'2026-09-25T12:00:00Z',updated_at:'stamp',profiles:{nickname:'크루장'},crews:{name:'테스트 크루',owner_id:'00000000-0000-4000-8000-000000000027'}};
    window.posts=[{...base,id:200},{...base,id:201,author_id:'other',content:'회원 글'}];history.pushState({},'', '/feed/200');dispatchEvent(new PopStateEvent('popstate'));
  }`);
  await until("document.querySelector('.post-pin-toggle')?.textContent==='크루 상단 고정'");
  await evaluate("failPin=true;document.querySelector('.post-pin-toggle').click()");
  await until("document.querySelector('.feed-page > .feed-error')?.textContent.includes('다시 조회')");
  assert.equal(await evaluate('posts[0].is_pinned'),false);
  await evaluate("failPin=false;document.querySelector('.post-pin-toggle').click();document.querySelector('.post-pin-toggle').click()");
  await until("document.querySelector('.post-pin-toggle')?.textContent==='고정 해제'");
  assert.equal(await evaluate('pinWrites'),2);
  await evaluate("document.querySelector('.feed-heading a').click()");
  await until("document.querySelector('.feed-preview')?.textContent==='크루장 알림'");
  assert.ok(await evaluate("!!document.querySelector('.feed-list .post-pin-label')"));
  await evaluate("document.querySelector('.feed-links a[href=\"/feed\"]').click()");
  await until("document.querySelector('.feed-preview')?.textContent==='회원 글'");
  await evaluate("document.querySelector('.feed-preview').click()");
  await until("document.querySelector('.post-content')?.textContent==='회원 글'");
  assert.equal(await evaluate("document.querySelectorAll('.post-pin-toggle').length"),0);
  await evaluate("history.pushState({},'', '/feed/200');dispatchEvent(new PopStateEvent('popstate'));");
  await until("document.querySelector('.post-pin-toggle')?.textContent==='고정 해제'");
  await evaluate("document.querySelector('.post-pin-toggle').click()");
  await until("document.querySelector('.post-pin-toggle')?.textContent==='크루 상단 고정'");
  await evaluate("document.querySelector('.feed-heading a').click()");
  await until("document.querySelector('.feed-preview')?.textContent==='회원 글'");
  console.log('Passed: own leader pin/unpin, failed pin preservation, double click lock, crew pinned ordering, public chronological order and other-author button hidden (mock API).');
  console.log('Passed: text post create/edit/delete, failed save preserves input, double-submit lock, delete cancel, denied/allowed crew writer, crew-default scope, public warning and missing edit (mock API).');
  console.log('Passed: invalid photo rejection, real PNG preview, failed upload blocks post, successful upload reused on post retry, signed image rendering, attachment preserved on edit and removed on save (mock Storage).');
  console.log('Passed: gym attachment with photo, automatic log kind, sharing notice, set rendering, running replacement, route OFF and record detachment (mock API).');
  console.log('Passed: like/cancel/member list, comment create/edit/delete/cancel, failed input preserved and double submit locked (mock API).');
  console.log('Passed: crew stats hidden threshold view, month totals, error hides stale totals, period switch and 320–1440px (mock API).');
  console.log('Passed: crew creation, filters, 320–1440px, leader approval, approved-only names, posting permission, kick confirmation, open join, cancellation, leave and double-click lock (mock API).');
} finally { await fetch('http://127.0.0.1:9223/json/close/'+tab.id).catch(()=>{});socket.close(); }
