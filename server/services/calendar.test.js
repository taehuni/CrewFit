import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL ||= 'https://example.supabase.co';process.env.SUPABASE_ANON_KEY ||= 'test';
const {calendarEvent,exportPlan,checkCalendarConnection}=await import('./calendar.js');
const plan={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'저녁 운동',sport:'walking',scheduled_on:'2026-10-09',start_time:'23:30:00',minutes:60,note:'민감한 메모'};
const user={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',identities:[{provider:'google',identity_data:{sub:'google-me'}}]};
function database(value=plan){return {from(table){if(table==='calendar_exports')return {upsert:async()=>({error:null})};const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:value,error:null})};return q;}};}
test('calendar event uses stable legal ID, KST crossing midnight, excludes notes',()=>{const e=calendarEvent(plan,user.id);assert.match(e.id,/^[a-v0-9]{5,1024}$/);assert.equal(e.id,calendarEvent(plan,user.id).id);assert.equal(e.start.dateTime,'2026-10-09T14:30:00.000Z');assert.equal(e.end.dateTime,'2026-10-09T15:30:00.000Z');assert.ok(!JSON.stringify(e).includes(plan.note));});
test('calendar retries read deterministic existing event; does not duplicate insert',async()=>{const e={...calendarEvent(plan,user.id),htmlLink:'https://calendar.google.com/calendar/event?eid=test'};let posts=0;const fetchImpl=async(url,init)=>{if(url.endsWith('/userinfo'))return Response.json({sub:'google-me'});if(init.method==='POST')posts++;return Response.json(e);};const r=await exportPlan(database(),user,plan.id,'provider',{fetchImpl});assert.equal(r.event_id,e.id);assert.equal(posts,0);});
test('calendar denies foreign plans before any external call and wrong Google identity',async()=>{let calls=0;await assert.rejects(exportPlan(database(null),user,plan.id,'provider',{fetchImpl:()=>{calls++;}}),{status:404});assert.equal(calls,0);await assert.rejects(exportPlan(database(),user,plan.id,'provider',{fetchImpl:async()=>Response.json({sub:'other'})}),{status:403});});
test('calendar creates missing event and handles denied scope without writing success',async()=>{let post;const fetchImpl=async(url,init)=>{if(url.endsWith('/userinfo'))return Response.json({sub:'google-me'});if(init.method!=='POST')return new Response('',{status:404});post=JSON.parse(init.body);return Response.json({...post,htmlLink:'https://calendar.google.com/calendar/event?eid=test'});};await exportPlan(database(),user,plan.id,'provider',{fetchImpl});assert.equal(post.summary,plan.title);await assert.rejects(exportPlan(database(),user,plan.id,'provider',{fetchImpl:async url=>url.endsWith('/userinfo')?Response.json({sub:'google-me'}):new Response('',{status:403})}),{status:403});});
test('connection check reads only calendar envelope, never creates or reads event content',async()=>{
 const urls=[];const result=await checkCalendarConnection(user,'provider',{fetchImpl:async(url,init)=>{urls.push(url);assert.equal(init.method,'GET');assert.equal(init.body,undefined);return Response.json(url.endsWith('/userinfo')?{sub:'google-me'}:{kind:'calendar#events'});}});
 assert.deepEqual(result,{connected:true});assert.equal(urls[1],'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=kind');
});
test('connection check distinguishes missing scope, API disabled, expired token and wrong owner',async()=>{
 const run=(status,reason)=>checkCalendarConnection(user,'provider',{fetchImpl:async url=>url.endsWith('/userinfo')?Response.json({sub:'google-me'}):Response.json({error:{errors:[{reason}],message:'secret provider details'}},{status})});
 await assert.rejects(()=>run(403,'insufficientPermissions'),{code:'calendar_permission'});
 await assert.rejects(()=>run(403,'accessNotConfigured'),{code:'calendar_api_disabled'});
 await assert.rejects(()=>run(401,'authError'),{code:'calendar_reconnect'});
 await assert.rejects(()=>checkCalendarConnection(user,'provider',{fetchImpl:async()=>Response.json({sub:'other'})}),{code:'calendar_account_mismatch'});
 await assert.rejects(()=>checkCalendarConnection(user,''),{code:'calendar_reconnect'});
 await assert.rejects(()=>checkCalendarConnection(user,'provider',{fetchImpl:async()=>{throw Error('secret-token');}}),error=>error.code==='calendar_unreachable'&&!error.message.includes('secret-token'));
});
test('temporary Google identity failures do not invalidate an otherwise usable connection',async()=>{
 for(const status of [429,500,503])await assert.rejects(()=>checkCalendarConnection(user,'provider',{fetchImpl:async()=>new Response('',{status})}),{status:502,code:'calendar_unreachable'});
});
