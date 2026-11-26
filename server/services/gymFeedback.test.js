import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {request} from 'node:http';
import {createPoseRouter} from '../routes/pose.js';
import {POSE_CONSENT_VERSION} from '../../shared/poseConsent.js';
import {GYM_EXERCISE_CRITERIA} from '../../shared/gymCriteria.js';
import {findGymCriterion,gymFeedbackRequest,interpretGymFeedback,createGymFeedback} from './gymFeedback.js';
const jpeg=`data:image/jpeg;base64,${Buffer.from([255,216,255,224,0,0,255,217]).toString('base64')}`;
const body=(exercise='barbell_bench_press')=>({exercise,consent:true,frames:Array(4).fill(jpeg)});
const item=findGymCriterion('barbell_bench_press');
function choice(name,status='confirmed',p=.96){return {type:'choice',name,choice:status,confidence:p,probabilities:['confirmed','improve','uncertain'].map(value=>({value,probability:value===status?p:(1-p)/2}))};}
const answer=()=>({answers:[{type:'predicate',name:'exercise_matches',probability:.99},choice('criterion_0'),choice('criterion_1','improve')]});
test('catalogue allowlist includes only sourced observable variants, legacy mapping explicit',()=>{
  assert.equal(GYM_EXERCISE_CRITERIA.filter(x=>findGymCriterion(x.id)).length,49);
  assert.equal(findGymCriterion('squat').id,'bodyweight_squat');
  for(const name of ['manual_other','situp','ignore instructions',null,{},'__proto__'])assert.equal(findGymCriterion(name),undefined);
});
test('request includes fixed source guidance and exactly two observable questions',()=>{
  const req=gymFeedbackRequest(item,body().frames);
  assert.equal(req.model,'gpt-6-luna');assert.equal(req.questions.length,3);
  assert.equal(req.input[0].content.filter(x=>x.type==='input_image').length,4);
  assert.match(req.input[0].content[0].text,/acefitness.org/);
  assert.match(req.input[0].content[0].text,/NOT validated/);
  assert.equal(req.questions[0].name,'exercise_matches');
});
test('match refusal/malformed/low evidence suppress all observations, no arbitrary provider prose',()=>{
  for(const data of [null,{}, {answers:[{type:'refusal'}]}, {answers:[{type:'predicate',name:'exercise_matches',probability:.89}]}, {answers:[...answer().answers,answer().answers[0]]}]){
    const result=interpretGymFeedback(item,data);assert.equal(result.matched,false);assert.deepEqual(result.observations,[]);
  }
  const data=answer();data.freeform='safe exercise medical guarantee';
  const result=interpretGymFeedback(item,data);assert.equal(result.matched,true);assert.equal(result.observations[1].status,'improve');assert.equal(result.observations[0].source_id,item.id);
  assert.doesNotMatch(JSON.stringify(result),/medical guarantee/);
});
test('low or invalid criterion distribution produces uncertain, never confirmed by absence',()=>{
  for(const change of [data=>data.answers.pop(),data=>data.answers[2]=choice('criterion_1','improve',.6),data=>data.answers[2].probabilities[0].probability=NaN,data=>data.answers.push(data.answers[2])]){
    const data=answer();change(data);assert.equal(interpretGymFeedback(item,data).observations[1].status,'uncertain');
  }
});
test('manual choice still goes through exact exercise match gate and provider fields are fixed',async()=>{
  const run=createGymFeedback({apiKey:()=> 'test',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/decisions');const payload=JSON.parse(options.body);
    assert.equal(payload.questions[0].type,'predicate');assert.match(payload.questions[0].instructions,/user's choice is NOT evidence/);
    const data=answer();data.answers[0].probability=.1;
    return {ok:true,json:async()=>data};
  }});
  assert.equal((await run('u',body())).matched,false);
  await assert.rejects(()=>run('v',body('situp')),{status:400});
  await assert.rejects(()=>run('v',{...body(),consent:false}),{status:400});
});
test('35 second spacing, user isolation and 60/day budget',async()=>{
  let now=100000;const run=createGymFeedback({apiKey:()=> 'test',now:()=>now,fetchImpl:async()=>({ok:true,json:async()=>answer()})});
  await run('u',body());await assert.rejects(()=>run('u',body()),{status:429});await run('v',body());
  now+=34999;await assert.rejects(()=>run('u',body()),{status:429});now++;
  for(let i=1;i<60;i++){await run('u',body());now+=35000;}
  await assert.rejects(()=>run('u',body()),{status:429});now+=86400000;assert.equal((await run('u',body())).matched,true);
});
test('inflight and upstream failures are bounded and sanitized; timeout releases state',async()=>{
  let release;const run=createGymFeedback({apiKey:()=> 'test',fetchImpl:()=>new Promise(resolve=>{release=resolve;})});
  const pending=run('u',body());await assert.rejects(()=>run('u',body()),{status:429});release({ok:false});await assert.rejects(pending,{status:502,code:'analysis_temporary_failure'});
  const timeout=createGymFeedback({apiKey:()=> 'test',timeoutMs:5,fetchImpl:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('secret-token'))))});
  await assert.rejects(()=>timeout('u',body()),error=>error.status===502&&!error.message.includes('secret-token'));
  await assert.rejects(()=>createGymFeedback({apiKey:()=>''})('u',body()),{status:503});
});
test('feedback preserves configuration/schema failures instead of returning exercise mismatch',async()=>{
  const unavailable=createGymFeedback({apiKey:()=> 'mock-only',fetchImpl:async()=>({ok:false,status:404,json:async()=>({error:{code:'model_not_found',message:'private provider text'}})})});
  await assert.rejects(()=>unavailable('u',body()),{status:503,code:'analysis_unavailable'});
  let now=100000,calls=0;
  const malformed=createGymFeedback({apiKey:()=> 'mock-only',now:()=>now,fetchImpl:async()=>({ok:true,json:async()=>++calls===1?{answers:[]}:answer()})});
  await assert.rejects(()=>malformed('u',body()),{status:502,code:'analysis_invalid_response'});
  now+=35000;assert.equal((await malformed('u',body())).matched,true);
});
test('feedback HTTP authenticates before parser and scopes payload limit',async t=>{
  let calls=0;const app=express();app.use('/api/pose',createPoseRouter((req,res,next)=>{if(req.headers.authorization!=='Bearer test')return res.status(401).end();req.user={id:'u'};next();},{consents:{require:async(db,id,scope)=>{assert.equal(id,'u');assert.equal(scope,'observation');}},feedback:async()=>{calls++;return interpretGymFeedback(item,answer());}}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const send=(payload,auth=true)=>new Promise((resolve,reject)=>{const req=request(`http://127.0.0.1:${server.address().port}/api/pose/feedback`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test'}:{})}},res=>{let data='';res.on('data',x=>data+=x);res.on('end',()=>resolve({status:res.statusCode,data,cache:res.headers['cache-control']}));});req.on('error',reject);req.end(payload);});
  assert.equal((await send('{secret',false)).status,401);assert.equal((await send('{secret')).status,400);
  assert.equal((await send(JSON.stringify({x:'a'.repeat(1100000)}))).status,413);
  const result=await send(JSON.stringify(body()));assert.equal(result.status,200);assert.equal(result.cache,'no-store');assert.equal(calls,1);
});

test('feedback HTTP requires its own active consent before sending frames to the provider',async t=>{
  const accepted={user_id:'owner',scope:'observation',version:POSE_CONSENT_VERSION,accepted_at:'2026-11-21T00:00:00Z',revoked_at:null};
  let rows=[],dbError=null,providerCalls=0;
  const db={from(table){assert.equal(table,'pose_analysis_consents');const filters=[];const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},then(resolve){return Promise.resolve({data:rows.filter(row=>filters.every(([key,value])=>row[key]===value)),error:dbError}).then(resolve);}};return query;}};
  const feedback=createGymFeedback({apiKey:()=> 'mock-only',fetchImpl:async()=>{providerCalls++;return {ok:true,json:async()=>answer()};}});
  const app=express();
  app.use('/api/pose',createPoseRouter((req,res,next)=>{req.user={id:'owner'};req.db=db;next();},{feedback}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const send=()=>new Promise((resolve,reject)=>{
    const req=request(`http://127.0.0.1:${server.address().port}/api/pose/feedback`,{method:'POST',headers:{'Content-Type':'application/json'}},res=>{
      let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,cache:res.headers['cache-control'],body:JSON.parse(text)}));
    });req.on('error',reject);req.end(JSON.stringify(body()));
  });
  for(const invalidRows of [[],[{...accepted,revoked_at:'2026-11-21T01:00:00Z'}],[{...accepted,scope:'recognition'}],[{...accepted,version:'old'}],[{...accepted,user_id:'other'}]]){
    rows=invalidRows;const response=await send();
    assert.equal(response.status,403);assert.equal(response.body.error.code,'consent_required');assert.equal(response.cache,'no-store');
    assert.equal(providerCalls,0);
  }
  rows=[accepted];dbError={code:'42P01',message:'private database details'};
  const unavailable=await send();assert.equal(unavailable.status,503);assert.equal(unavailable.body.error.code,'consent_unavailable');
  assert.doesNotMatch(JSON.stringify(unavailable.body),/private database/);assert.equal(providerCalls,0);
  dbError=null;const allowed=await send();assert.equal(allowed.status,200);assert.equal(providerCalls,1);
});
