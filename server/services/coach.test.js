import test from 'node:test';import assert from 'node:assert/strict';
import {validatePlan,askCoach,savePlans,chat} from './coach.js';
const plan={title:'걷기',sport:'walking',scheduled_on:'2026-10-12',start_time:'20:00',minutes:20,note:'가볍게'};
test('plans validate calendar dates, durations and allowlisted sports',()=>{assert.deepEqual(validatePlan(plan),plan);for(const change of [{scheduled_on:'2026-02-30'},{minutes:0},{minutes:241},{start_time:'25:00'},{sport:'unknown'},{title:''},{note:'a'.repeat(1001)}])assert.throws(()=>validatePlan({...plan,...change}));});
test('structured provider response validated; refusal, incomplete and malformed are failures',async()=>{
 let sent;const response=(content,status='completed')=>async(_,request)=>{sent=JSON.parse(request.body);return {ok:true,json:async()=>({status,output:[{type:'message',role:'assistant',content}]})};};
 const result=await askCoach({message:'계획'},{apiKey:'fake',fetchImpl:response([{type:'output_text',text:JSON.stringify({answer:'제안이에요',plans:[plan],meals:[]})}])});
 assert.equal(result.proposals.length,1);assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);
 for(const blocks of [[{type:'refusal'}],[{type:'output_text',text:'bad'}],[{type:'output_text',text:JSON.stringify({answer:'a',plans:[{...plan,minutes:999}]})}]])await assert.rejects(askCoach({},{apiKey:'fake',fetchImpl:response(blocks)}));
 await assert.rejects(askCoach({},{apiKey:'fake',fetchImpl:response([],'incomplete')}));
});
test('unowned or missing source turn cannot save; duplicate positions are rejected',async()=>{
 const db={from(){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:null})}}};
 await assert.rejects(savePlans(db,'me',{turn_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',items:[{...plan,position:0}]}),{status:404});
 await assert.rejects(chat({},'me',{id:'bad',message:'a'}),{status:400});
});

test('28 workout proposals accepted, 29 rejected',async()=>{
 const mock=n=>async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer:'4주 계획',plans:Array.from({length:n},()=>plan),meals:[]})}]}]})});
 assert.equal((await askCoach({}, {apiKey:'fake',fetchImpl:mock(28)})).proposals.length,28);
 await assert.rejects(askCoach({}, {apiKey:'fake',fetchImpl:mock(29)}));
});
test('all 28 positions save without truncation',async()=>{
 let inserted;
 const db={from(table){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{proposals:Array.from({length:28},()=>plan)}}),upsert:async rows=>{inserted=rows;return {data:null}},order:async()=>({data:inserted})}}};
 const rows=await savePlans(db,'me',{turn_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',items:Array.from({length:28},(_,position)=>({...plan,position}))});
 assert.equal(rows.length,28);assert.equal(rows[27].position,27);
});

import {starterSchedule,validateStarterSchedule} from './starterSchedule.js';
test('starter schedule computes exact weekdays and rejects missing or wrong dates',()=>{
 const schedule=starterSchedule('처음 운동을 시작하려고 해요. 아래 선택을 바탕으로 4주 입문 계획\n시작 날짜: 2026-10-21 (한국시간)\n가능한 요일: 월, 수\n한 번에 가능한 시간: 20분\n시작 시각: 19:00');
 assert.deepEqual(schedule.dates.map(d=>d.date),['2026-10-21','2026-10-26','2026-10-28','2026-11-02','2026-11-04','2026-11-09','2026-11-11','2026-11-16']);
 const plans=schedule.dates.map(d=>({...plan,scheduled_on:d.date,start_time:'19:00'}));
 assert.doesNotThrow(()=>validateStarterSchedule(plans,schedule));
 assert.throws(()=>validateStarterSchedule(plans.slice(0,7),schedule));
 assert.throws(()=>validateStarterSchedule([{...plans[0],scheduled_on:'2026-10-23'},...plans.slice(1)],schedule));
 assert.throws(()=>validateStarterSchedule([{...plans[0],minutes:21},...plans.slice(1)],schedule));
});

test('starter phase totals are validated before accepting a proposal',async()=>{
 const message='처음 운동을 시작하려고 해요. 아래 선택을 바탕으로 1주 입문 계획\n시작 날짜: 2026-10-21 (한국시간)\n가능한 요일: 수\n한 번에 가능한 시간: 20분\n시작 시각: 19:00';
 const response=middle=>async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer:'계획 제안',plans:[{...plan,scheduled_on:'2026-10-21',start_time:'19:00',steps:[{minutes:3,detail:'준비'},{minutes:middle,detail:'걷기'},{minutes:3,detail:'정리'}]}],meals:[]})}]}]})});
 const result=await askCoach({message},{apiKey:'fake',fetchImpl:response(14)});
 assert.match(result.proposals[0].note,/본운동 14분/);
 await assert.rejects(askCoach({message},{apiKey:'fake',fetchImpl:response(16)}));
});
