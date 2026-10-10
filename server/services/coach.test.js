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
