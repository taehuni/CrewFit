// Isolated view test: no real session or database writes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const out = process.argv[2];
const target = await fetch('http://127.0.0.1:9223/json/new?about:blank', {method:'PUT'}).then(r=>r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0;
const pending=new Map();
socket.addEventListener('message',e=>{
  const msg=JSON.parse(e.data),entry=pending.get(msg.id);
  if(!entry)return;
  pending.delete(msg.id);clearTimeout(entry.timer);
  msg.error?entry.reject(new Error(JSON.stringify(msg.error))):entry.resolve(msg.result);
});
const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timeout'));},15000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
});
async function evaluate(expression){
  const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
try {
  await send('Page.enable');
  await send('Page.bringToFront');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5173/login'});
  for(let i=0;i<80;i++){
    if(await evaluate("!!document.querySelector('.auth-heading')"))break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.auth-brand .brand-mark')).fill"),'none');
  if(out){
    await mkdir(out,{recursive:true});
    await evaluate('document.fonts.ready');
    const clip=await evaluate("(()=>{const r=document.querySelector('.auth-brand .wordmark').getBoundingClientRect();return {x:r.x-8,y:r.y-8,width:r.width+16,height:r.height+16,scale:2}})()");
    const {data}=await send('Page.captureScreenshot',{format:'png',clip});
    await writeFile(join(out,'logo-auth-dark.png'),Buffer.from(data,'base64'));
  }
  await evaluate(`(async()=>{
    const shellCode=await fetch('/src/shared/AppShell.jsx').then(r=>r.text());
    const routerURL=shellCode.split('"').find(part=>part.startsWith('/node_modules/.vite/deps/react-router.js'));
    const [R,D,T,S,H,W,F,V,J,L,Q]=await Promise.all([
      import('/node_modules/.vite/deps/react.js'),import('/node_modules/.vite/deps/react-dom_client.js'),
      import(routerURL),import('/src/shared/AppShell.jsx'),
      import('/src/features/dashboard/HomeView.jsx'),import('/src/features/dashboard/week.js'),
      import('/src/features/activities/ActivityForm.jsx'),import('/src/features/activities/ActivityDetailView.jsx'),import('/src/features/activities/record.js'),import('/src/features/activities/ActivityListView.jsx'),import('/src/features/activities/activityList.js')
    ]);
    const React=R.default,h=React.createElement;
    document.getElementById('root').style.display='none';
    const mount=document.createElement('div');mount.id='workspace-test';document.body.append(mount);
    const root=(D.createRoot || D.default.createRoot)(mount);
    const detailData=state=>({
      isPending:state==='loading',isError:state==='error',refetch:()=>window.previewRetry++,
      data:state==='missing'?null:{
        activity:{id:2,sport:state==='running'?'running':'gym',performed_on:'2026-09-14',duration_sec:1800,distance_m:state==='running'?5200:null,note:state==='running'?null:'첫 세트는 가볍게.\\n<img src=x onerror=alert(1)>'},
        sets:state==='running'||state==='no-sets'?[]:[
          {id:1,exercise_name:'스쿼트',set_no:1,reps:10,weight_kg:0},
          {id:2,exercise_name:'스쿼트',set_no:2,reps:12,weight_kg:20.5},
          {id:3,exercise_name:'벤치프레스',set_no:1,reps:null,weight_kg:null}
        ]
      }
    });
    function PreviewActivity(){
      const [search]=T.useSearchParams();
      return h(F.default,{key:search.get('sport'),initialSport:search.get('sport'),today:'2026-09-13',onSave:async()=>{}});
    }
    const sample=[
      {id:1,sport:'running',performed_on:'2026-09-13',duration_sec:1860,distance_m:5200},
      {id:2,sport:'gym',performed_on:'2026-09-11',duration_sec:3600,distance_m:null},
      {id:3,sport:'walking',performed_on:'2026-09-09',duration_sec:2400,distance_m:3100}
    ];
    window.previewRetry=0;
    window.renderWorkspace=state=>{
      function Preview(){
        const [offset,setOffset]=React.useState(0);
        const me={data:{profile:{nickname:state==='long'?'아주긴닉네임을가진운동하는사람입니다':'러닝메이트',main_sport:'running',level:'beginner'},settings:{region_sigungu:'마포구'}},refetch:()=>window.previewRetry++};
        const records=state==='populated'?sample:[];
        const goals=state==='populated'?[{id:1,type:'count',sport:null,target:3,current:3,progress:1,period:'week',from:'2026-09-07',to:'2026-09-13'}]:[];
        const streak=state==='populated'?{current:3,best:8,today_done:true}:{current:0,best:0,today_done:false};
        const log={data:{recent:records,totals:{activity_count:records.length,distance_m:records.reduce((s,r)=>s+(r.distance_m||0),0),duration_sec:records.reduce((s,r)=>s+r.duration_sec,0)},days:W.weekDates('2026-09-13',offset).map(date=>({date,activity_count:records.filter(r=>r.performed_on===date).length})),goals,streak},isPending:state==='loading',isError:state==='error',refetch:()=>window.previewRetry++};
        return h(H.default,{me,log,days:W.weekDates('2026-09-13',offset),today:'2026-09-13',offset,onWeekChange:setOffset});
      }
      root.render(h(T.MemoryRouter,{initialEntries:['/home'],key:state},h(T.Routes,null,
        h(T.Route,{element:h(S.WorkspaceFrame,{nickname:state==='long'?'아주긴닉네임을가진운동하는사람입니다':'러닝메이트',number:'027'})},h(T.Route,{path:'/home',element:h(Preview)}),h(T.Route,{path:'/activities/new',element:h(PreviewActivity)}),h(T.Route,{path:'/activities/:activityId',element:h(V.default,{detail:detailData('gym')})})))));
    };
    window.renderDetail=state=>{
      root.render(h(T.MemoryRouter,{initialEntries:['/activities/2'],key:'detail-'+state},h(T.Routes,null,
        h(T.Route,{element:h(S.WorkspaceFrame,{nickname:'러닝메이트',number:'027'})},h(T.Route,{path:'/activities/:activityId',element:h(V.default,{detail:detailData(state)})})))));
    };
    window.previewEdits=[];
    window.renderEdit=sport=>{
      const data=detailData(sport).data;
      data.activity.duration_sec=1805;
      root.render(h(T.MemoryRouter,{initialEntries:['/activities/2/edit'],key:'edit-'+sport},h(T.Routes,null,
        h(T.Route,{element:h(S.WorkspaceFrame,{nickname:'러닝메이트',number:'027'})},
          h(T.Route,{path:'/activities/:activityId/edit',element:h(F.default,{editing:true,initialValues:J.activityFormValues(data),cancelTo:'/activities/2',onSave:async payload=>{
            window.previewEdits.push(payload);
            if(window.previewEditFail)throw {code:'PGRST202'};
          }})})))));
    };
    window.previewDeletes=0;
    window.renderDelete=()=>{
      root.render(h(T.MemoryRouter,{initialEntries:['/activities/2'],key:'delete'},h(T.Routes,null,
        h(T.Route,{element:h(S.WorkspaceFrame,{nickname:'러닝메이트',number:'027'})},
          h(T.Route,{path:'/activities/:activityId',element:h(V.default,{detail:detailData('gym'),onDelete:()=>{
            window.previewDeletes++;
            return new Promise((resolve,reject)=>{window.finishDelete=resolve;window.failDelete=()=>reject(new Error('offline'));});
          }})})))));
    };
    const listSample=Array.from({length:25},(_,i)=>({id:100-i,sport:i%2?'gym':'running',performed_on:i<20?'2026-09-14':'2026-09-13',duration_sec:1805,distance_m:i%2?null:5200,note:i===0?'메모 첫 줄 <img src=x>':null}));
    window.renderLibrary=state=>{
      function PreviewList(){
        const [search,setSearch]=T.useSearchParams();
        const filters=Q.listFilters(search);
        const [count,setCount]=React.useState(20);
        const rows=(state==='empty'?[]:listSample).filter(row=>(!filters.sport||row.sport===filters.sport)&&(!filters.from||row.performed_on>=filters.from)&&(!filters.to||row.performed_on<=filters.to));
        const records={data:state==='loading'||state==='error'?undefined:{pages:[{items:rows.slice(0,count)}]},
          isPending:state==='loading',isError:state==='error'||state==='more-error',isFetchNextPageError:state==='more-error',
          hasNextPage:rows.length>count,isFetching:false,refetch:()=>window.previewRetry++,
          fetchNextPage:async()=>{window.previewMore=(window.previewMore||0)+1;setCount(40)}};
        window.previewListSearch=search.toString();
        return h(L.default,{filters,filterMessage:Q.filterError(filters),records,onFilter:next=>{setCount(20);setSearch(Q.listURL(next).split('?')[1]||'')}});
      }
      root.render(h(T.MemoryRouter,{initialEntries:[state==='invalid'?'/activities?from=bad':'/activities'],key:'library-'+state},h(T.Routes,null,
        h(T.Route,{element:h(S.WorkspaceFrame,{nickname:'러닝메이트',number:'027'})},
          h(T.Route,{path:'/activities',element:h(PreviewList)}),
          h(T.Route,{path:'/activities/new',element:h(PreviewActivity)}),
          h(T.Route,{path:'/activities/:activityId',element:h(V.default,{detail:detailData('gym')})})))));
    };
    window.previewSaves=[];
    window.renderActivity=(initialSport='running')=>{
      root.render(h(T.MemoryRouter,{initialEntries:['/activities'],key:'activity-'+initialSport},h(T.Routes,null,
        h(T.Route,{element:h(S.WorkspaceFrame,{nickname:'러닝메이트',number:'027'})},h(T.Route,{path:'/activities',element:h(F.default,{initialSport,today:'2026-09-13',
          exerciseNames:window.historyUnavailable?[]:['내 덤벨 운동','스쿼트','Squat'],exerciseNamesError:!!window.historyUnavailable,
          onExerciseNameFocus:()=>window.historyRequests=(window.historyRequests||0)+1,
          onExerciseNamesRetry:()=>window.historyRetries=(window.historyRetries||0)+1,onSave:async payload=>{
          window.previewSaves.push(payload);
          if(window.previewFail)throw new Error('test failure');
        }})})))));
    };
    window.fillInput=(id,value)=>{
      const input=document.getElementById(id);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    };
  })()`);
  for(const [state,width,height] of [
    ['empty',1440,1000],['populated',1440,1000],['empty',1280,800],['empty',960,800],
    ['empty',768,900],['empty',375,812],['empty',320,740],['populated',375,812],
    ['error',375,812],['loading',375,812],['long',960,800]
  ]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
    await evaluate('window.renderWorkspace('+JSON.stringify(state)+')');
    await new Promise(r=>setTimeout(r,150));
    await evaluate('document.fonts.ready');
    const m=await evaluate(`(()=>{
      const s=document.querySelector('#workspace-test'),nav=s.querySelector('.ws-nav').getBoundingClientRect();
      return {width:innerWidth,scroll:document.documentElement.scrollWidth,h1:s.querySelectorAll('h1').length,
        days:s.querySelectorAll('.home-week li').length,selected:s.querySelectorAll('.ws-nav-item[aria-current]').length,
        records:s.querySelectorAll('.home-record-list li').length,goals:s.querySelectorAll('.goal-progress-list li').length,empty:!!s.querySelector('.home-log-empty'),
        alerts:s.querySelectorAll('[role=alert]').length,navBottom:nav.bottom,
        logoFill:getComputedStyle(s.querySelector('.brand-mark')).fill,
        headerHeight:s.querySelector('.ws-header').getBoundingClientRect().height,
        today:s.querySelector('.home-week [aria-current="date"] > span').textContent,
        dashes:[...s.querySelectorAll('.week-marks')].filter(e=>e.textContent==='—').length,
        totals:[...s.querySelectorAll('.home-totals strong')].map(e=>e.textContent),streak:[...s.querySelectorAll('.home-streak dd strong')].map(e=>e.textContent),
        clipped:[...s.querySelectorAll('button,a,h1')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left < -1||r.right>innerWidth+1);}).map(e=>e.textContent)};
    })()`);
    assert.equal(m.width,width);assert.ok(m.scroll<=width);assert.equal(m.h1,1);
    assert.equal(m.days,7);assert.equal(m.selected,1);assert.deepEqual(m.clipped,[]);
    assert.equal(m.logoFill,'none');assert.equal(m.headerHeight,72);
    assert.equal(m.today,'오늘');assert.equal(m.dashes,0);
    assert.equal(m.records,state==='populated'?3:0);
    assert.equal(m.goals,state==='populated'?1:0);
    assert.deepEqual(m.streak,state==='populated'?['3','8','완료']:state==='loading'||state==='error'?['—','—','—']:['0','0','아직']);
    assert.deepEqual(m.totals,state==='populated'?['3','8.3','2:11']:state==='loading'||state==='error'?['—','—','—']:['0','0.0','0:00']);
    if(state==='loading'||state==='error')assert.equal(m.empty,false);
    if(state==='error'){
      assert.equal(m.alerts,1);
      await evaluate("document.querySelector('.home-text-button').click()");
      assert.equal(await evaluate('window.previewRetry'),1);
    }
    if(width<960)assert.ok(Math.abs(m.navBottom-height)<2);
    if(out){
      const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      await writeFile(join(out,state+'-'+width+'.png'),Buffer.from(data,'base64'));
    }
    console.log(JSON.stringify({state,width,...m}));
  }
  await evaluate("document.querySelector('.week-controls button').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.querySelector('.home-section-head p').textContent"),'2026.08.31 — 09.06');
  await evaluate("document.querySelector('.week-controls button:nth-child(2)').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.querySelector('.home-section-head p').textContent"),'2026.09.07 — 09.13');
  console.log('Week navigation and retry passed.');
  for(const sport of ['running','gym']){
    await evaluate('window.renderWorkspace('+JSON.stringify('shortcut-'+sport)+')');
    await new Promise(r=>setTimeout(r,100));
    await evaluate('document.querySelector('+JSON.stringify('.home-sport-link[href="/activities/new?sport='+sport+'"]')+').click()');
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate("document.querySelector('#workspace-test input[name=sport]:checked').value"),sport);
  }
  await evaluate("window.renderActivity('unsupported')");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.querySelector('#workspace-test input[name=sport]:checked').value"),'running');
  console.log('Sport shortcuts and unsupported-sport fallback passed.');
  await evaluate('window.renderActivity()');
  await new Promise(r=>setTimeout(r,150));
  await evaluate("document.querySelector('#workspace-test form').requestSubmit()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.querySelectorAll('#workspace-test [aria-invalid=true]').length"),2);
  await evaluate("window.fillInput('activity-minutes','31');window.fillInput('activity-distance','5.2');window.previewFail=true");
  await new Promise(r=>setTimeout(r,100));
  await evaluate("document.querySelector('#workspace-test form').requestSubmit()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate('window.previewSaves[0].activity.distance_m'),5200);
  assert.equal(await evaluate("document.getElementById('activity-minutes').value"),'31');
  assert.match(await evaluate("document.querySelector('#workspace-test .form-msg').textContent"),/입력 내용은 유지/);
  await evaluate("document.querySelector('#workspace-test input[value=gym]').click();window.previewFail=false");
  await new Promise(r=>setTimeout(r,100));
  await evaluate("window.fillInput('name-0','스쿼트');window.fillInput('reps-0','10');window.fillInput('weight-0','0')");
  await new Promise(r=>setTimeout(r,100));
  await evaluate("document.querySelector('#workspace-test form').requestSubmit()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate('window.previewSaves[1].sets[0].reps'),10);
  for(const width of [1440,375,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await new Promise(r=>setTimeout(r,100));
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    if(out){
      const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      await writeFile(join(out,'gym-'+width+'.png'),Buffer.from(data,'base64'));
    }
  }
  console.log('Running validation, save failure preservation, gym submit and responsive form passed (mock saves only).');
  await evaluate("window.renderActivity('gym')");
  await new Promise(r=>setTimeout(r,100));
  await evaluate("document.getElementById('name-0').focus()");
  await new Promise(r=>setTimeout(r,100));
  assert.match(await evaluate("document.querySelector('[role=option]')?.textContent || JSON.stringify({active:document.activeElement.id,expanded:document.getElementById('name-0').getAttribute('aria-expanded'),value:document.getElementById('name-0').value,requests:window.historyRequests})"),/내 덤벨 운동내 기록/);
  assert.equal(await evaluate("document.getElementById('name-0').getAttribute('aria-expanded')"),'true');
  assert.equal(await evaluate("document.querySelectorAll('[role=option]').length"),8);
  const saveCount=await evaluate('window.previewSaves.length');
  async function key(key,code,number){
    await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:number});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:number});
    await new Promise(r=>setTimeout(r,60));
  }
  await key('ArrowDown','ArrowDown',40);
  assert.equal(await evaluate("document.getElementById('name-0').getAttribute('aria-activedescendant')"),'name-0-suggestions-0');
  await key('Enter','Enter',13);
  assert.equal(await evaluate("document.getElementById('name-0').value"),'내 덤벨 운동');
  assert.equal(await evaluate('window.previewSaves.length'),saveCount);
  assert.equal(await evaluate("document.getElementById('name-0').getAttribute('aria-expanded')"),'false');
  await evaluate("window.fillInput('name-0','벤치')");
  await new Promise(r=>setTimeout(r,80));
  await evaluate("document.getElementById('name-0').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}))");
  assert.equal(await evaluate("document.getElementById('name-0').value"),'벤치');
  assert.equal(await evaluate("document.getElementById('name-0').getAttribute('aria-expanded')"),'true');
  await key('Escape','Escape',27);
  assert.equal(await evaluate("document.getElementById('name-0').value"),'벤치');
  assert.equal(await evaluate("document.querySelectorAll('[role=option]').length"),0);
  await key('ArrowDown','ArrowDown',40);
  await key('Tab','Tab',9);
  assert.equal(await evaluate('document.activeElement.id'),'reps-0');
  assert.equal(await evaluate("document.querySelectorAll('[role=option]').length"),0);
  for(const width of [1440,375,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await evaluate("window.fillInput('name-0','');document.getElementById('name-0').focus();document.getElementById('name-0').scrollIntoView({block:'center'})");
    await new Promise(r=>setTimeout(r,100));
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert.ok(await evaluate("[...document.querySelectorAll('[role=option]')].every(e=>e.getBoundingClientRect().height>=44)"));
    if(out){
      const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      await writeFile(join(out,'autocomplete-'+width+'.png'),Buffer.from(data,'base64'));
    }
  }
  // Real touch dispatch rather than a synthetic click: input blur must not discard selection.
  const point=await evaluate("(()=>{const r=document.querySelector('[role=option]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.getElementById('name-0').value"),'내 덤벨 운동');
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await evaluate("window.fillInput('name-0','나만의 새로운 운동');window.fillInput('activity-minutes','0');window.fillInput('activity-seconds','45');window.fillInput('reps-0','10');window.fillInput('weight-0','0')");
  await new Promise(r=>setTimeout(r,80));
  assert.match(await evaluate("document.querySelector('.exercise-suggestions').textContent"),/입력한 이름으로 저장/);
  await evaluate("document.querySelector('#workspace-test form').requestSubmit()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate('window.previewSaves.at(-1).sets[0].exercise_name'),'나만의 새로운 운동');
  assert.equal(await evaluate('window.previewSaves.at(-1).activity.duration_sec'),45);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.activity-duration label')].map(e=>e.textContent)"),['분','초']);
  await evaluate("window.historyUnavailable=true;window.renderActivity('history-error')");
  await new Promise(r=>setTimeout(r,100));
  await evaluate("document.querySelector('#workspace-test input[value=gym]').click()");
  await new Promise(r=>setTimeout(r,80));
  await evaluate("document.getElementById('name-0').focus()");
  await new Promise(r=>setTimeout(r,80));
  assert.match(await evaluate("document.querySelector('[role=option]').textContent"),/스쿼트기본 운동/);
  assert.match(await evaluate("document.querySelector('.exercise-history-status').textContent"),/기본 추천과 직접 입력/);
  await evaluate("document.querySelector('.exercise-history-status button').click()");
  assert.equal(await evaluate('window.historyRetries'),1);
  await evaluate('window.historyUnavailable=false');
  console.log('Autocomplete own-first/seed fallback/free input/keyboard/IME/touch, 320–1440px layouts and create seconds passed (mock history and saves).');
  await evaluate("window.renderWorkspace('populated')");
  await new Promise(r=>setTimeout(r,100));
  await evaluate("document.querySelector('#workspace-test a[href=\"/activities/2\"]').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.querySelector('#workspace-test h1').textContent"),'헬스 기록');
  assert.equal(await evaluate("document.querySelector('#workspace-test .ws-nav-item[aria-current=page]').getAttribute('href')"),'/activities');
  for(const [state,width] of [['gym',1440],['gym',375],['gym',320],['running',375],['no-sets',375],['error',375],['loading',375],['missing',375]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
    await evaluate('window.renderDetail('+JSON.stringify(state)+')');
    await new Promise(r=>setTimeout(r,100));
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert.equal(await evaluate("document.querySelectorAll('#workspace-test h1').length"),1);
    assert.equal(await evaluate("document.querySelectorAll('#workspace-test .activity-detail-note img').length"),0);
    const rows=await evaluate("document.querySelectorAll('#workspace-test tbody tr').length");
    assert.equal(rows,state==='gym'?3:0);
    if(state==='gym'){
      assert.match(await evaluate("document.querySelector('#workspace-test tbody td:last-child').textContent"),/^0kg$/);
      assert.match(await evaluate("document.querySelector('#workspace-test .activity-detail-note').textContent"),/<img/);
    }
    if(state==='error'){
      const before=await evaluate('window.previewRetry');
      await evaluate("document.querySelector('#workspace-test .activity-detail-state button').click()");
      assert.equal(await evaluate('window.previewRetry'),before+1);
    }
    if(out){
      const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      await writeFile(join(out,'detail-'+state+'-'+width+'.png'),Buffer.from(data,'base64'));
    }
  }
  console.log('Detail navigation, gym/running/empty/missing/error/loading states, note escaping and mobile layouts passed.');
  for(const sport of ['gym','running']){
    await evaluate('window.renderEdit('+JSON.stringify(sport)+')');
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate("document.getElementById('activity-minutes').value"),'30');
    assert.equal(await evaluate("document.getElementById('activity-seconds').value"),'5');
    assert.equal(await evaluate("document.querySelector('#workspace-test input[name=sport]:checked').value"),sport);
    assert.equal(await evaluate("document.querySelector('#workspace-test input[name=sport]').matches(':disabled')"),true);
    if(sport==='gym'){
      assert.equal(await evaluate("document.getElementById('weight-0').value"),'0');
      assert.equal(await evaluate("document.getElementById('weight-2').value"),'');
    }
    await evaluate("window.fillInput('activity-minutes','45');window.fillInput('activity-date','2026-09-13');window.previewEditFail=true");
    await new Promise(r=>setTimeout(r,100));
    await evaluate("document.querySelector('#workspace-test form').requestSubmit()");
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate('window.previewEdits.at(-1).activity.duration_sec'),2705);
    assert.equal(await evaluate('window.previewEdits.at(-1).activity.performed_on'),'2026-09-13');
    assert.equal(await evaluate("document.getElementById('activity-minutes').value"),'45');
    assert.match(await evaluate("document.querySelector('#workspace-test .form-msg').textContent"),/DB 함수/);
    await evaluate("window.previewEditFail=false;document.querySelector('#workspace-test form').requestSubmit()");
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate("document.querySelector('#workspace-test .form-msg')?.textContent || ''"),'');
    for(const width of [1440,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
      await new Promise(r=>setTimeout(r,100));
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
      if(out){
        const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        await writeFile(join(out,'edit-'+sport+'-'+width+'.png'),Buffer.from(data,'base64'));
      }
    }
  }
  await evaluate('window.renderDelete()');
  await new Promise(r=>setTimeout(r,100));
  await evaluate("document.querySelector('.activity-delete-open').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.querySelector('.activity-delete-dialog').open"),true);
  assert.equal(await evaluate('document.activeElement.textContent'),'취소');
  await evaluate("document.querySelector('.activity-delete-actions button').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("!!document.querySelector('.activity-delete-dialog')"),false);
  assert.equal(await evaluate('window.previewDeletes'),0);
  await evaluate("document.querySelector('.activity-delete-open').click()");
  await new Promise(r=>setTimeout(r,100));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("!!document.querySelector('.activity-delete-dialog')"),false);
  await evaluate("document.querySelector('.activity-delete-open').click()");
  await new Promise(r=>setTimeout(r,100));
  for(const width of [1440,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:740,deviceScaleFactor:1,mobile:width<768});
    await new Promise(r=>setTimeout(r,100));
    assert.ok(await evaluate("(()=>{const r=document.querySelector('.activity-delete-dialog').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight})()"));
    if(out){
      const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      await writeFile(join(out,'delete-'+width+'.png'),Buffer.from(data,'base64'));
    }
  }
  await evaluate("document.querySelector('.activity-delete-confirm').click();document.querySelector('.activity-delete-confirm').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate('window.previewDeletes'),1);
  assert.equal(await evaluate("document.querySelectorAll('.activity-delete-dialog button:disabled').length"),2);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.querySelector('.activity-delete-dialog').open"),true);
  await evaluate('window.failDelete()');
  await new Promise(r=>setTimeout(r,100));
  assert.match(await evaluate("document.querySelector('.activity-delete-dialog .form-msg').textContent"),/삭제 결과/);
  await evaluate("document.querySelector('.activity-delete-confirm').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate('window.previewDeletes'),2);
  await evaluate('window.finishDelete()');
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("!!document.querySelector('.activity-delete-dialog')"),false);
  console.log('Edit prefill/immutable sport/seconds/failure preservation and delete cancel/Escape/double-submit/retry/mobile checks passed (mock mutations only).');
  for(const [state,width] of [['populated',1440],['populated',768],['populated',375],['populated',320],['empty',320],['error',375],['loading',375],['more-error',375],['invalid',375]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await evaluate('window.renderLibrary('+JSON.stringify(state)+')');
    await new Promise(r=>setTimeout(r,120));
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert.equal(await evaluate("document.querySelectorAll('#workspace-test h1').length"),1);
    assert.equal(await evaluate("document.querySelectorAll('.activity-library-list img').length"),0);
    assert.equal(await evaluate("document.querySelectorAll('.activity-library-list li').length"),state==='populated'||state==='more-error'?20:0);
    assert.equal(await evaluate("document.querySelector('.ws-nav-item[aria-current=page]').getAttribute('href')"),'/activities');
    if(out){
      const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      await writeFile(join(out,'library-'+state+'-'+width+'.png'),Buffer.from(data,'base64'));
    }
  }
  await evaluate("window.renderLibrary('interactive')");
  await new Promise(r=>setTimeout(r,120));
  await evaluate("document.querySelector('.activity-list-more').click();document.querySelector('.activity-list-more').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate('window.previewMore'),1);
  assert.equal(await evaluate("document.querySelectorAll('.activity-library-list li').length"),25);
  assert.equal(await evaluate("!!document.querySelector('.activity-list-more')"),false);
  await evaluate("window.fillInput('filter-from','2026-09-15');window.fillInput('filter-to','2026-09-14')");
  await new Promise(r=>setTimeout(r,100));
  await evaluate("document.querySelector('.activity-filters').requestSubmit()");
  await new Promise(r=>setTimeout(r,100));
  assert.match(await evaluate("document.querySelector('#filter-to-error').textContent"),/빠를 수 없어요/);
  assert.equal(await evaluate('window.previewListSearch'),'');
  await evaluate("window.fillInput('filter-from','2026-09-14');document.getElementById('filter-sport').value='gym';document.getElementById('filter-sport').dispatchEvent(new Event('change',{bubbles:true}))");
  await new Promise(r=>setTimeout(r,100));
  await evaluate("document.querySelector('.activity-filters').requestSubmit()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate('window.previewListSearch'),'sport=gym&from=2026-09-14&to=2026-09-14');
  assert.equal(await evaluate("document.querySelectorAll('.activity-library-list li').length"),10);
  await evaluate("document.querySelector('.activity-library-row').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.querySelector('.activity-back').getAttribute('href')"),'/activities?sport=gym&from=2026-09-14&to=2026-09-14');
  await evaluate("document.querySelector('.activity-back').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.getElementById('filter-sport').value"),'gym');
  await evaluate("document.querySelector('.activity-filter-actions button:last-child').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate('window.previewListSearch'),'');
  await evaluate("document.querySelector('.activity-library-heading a').click()");
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate("document.querySelector('#workspace-test h1').textContent"),'운동 기록하기');
  console.log('Library filters, validation, reset, detail return, create link, pagination, failure states and responsive layouts passed.');
}finally{
  await fetch('http://127.0.0.1:9223/json/close/'+target.id).catch(()=>{});
  socket.close();
}
