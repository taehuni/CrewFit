import test from 'node:test';
import assert from 'node:assert/strict';
import {QueryClient} from '@tanstack/react-query';
import {POSE_CONSENT_VERSION,hasPoseConsent} from '../../../../shared/poseConsent.js';
import {changePoseConsent,poseConsentKey,poseConsentChangesKey,poseConsentQueryOptions,poseConsentState} from './poseConsentCache.js';

const deferred = ()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const state = (recognition=true,observation=true)=>({version:POSE_CONSENT_VERSION,consents:[
  {scope:'recognition',version:POSE_CONSENT_VERSION,accepted_at:'2026-11-21T00:00:00Z',revoked_at:recognition?null:'2026-11-21T01:00:00Z'},
  {scope:'observation',version:POSE_CONSENT_VERSION,accepted_at:'2026-11-21T00:00:00Z',revoked_at:observation?null:'2026-11-21T01:00:00Z'},
]});
const change = (client,request,extra={})=>changePoseConsent(client,{userId:'owner',scope:'recognition',accepted:false,isCurrent:()=>true,request,...extra});

test('revocation cancels the existing read signal and ignores its late accepted response',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  const key=poseConsentKey('owner'),read=deferred();let signal;
  client.setQueryData(key,state());
  const options=poseConsentQueryOptions({userId:'owner',scope:'recognition',enabled:true,request:(_,{signal:input})=>{signal=input;return read.promise;}});
  const reading=client.fetchQuery(options).catch(error=>error);
  const saved=await change(client,async(path,options)=>{
    assert.equal(path,'/pose/consents');assert.equal(signal.aborted,true);
    assert.deepEqual(options.body,{scope:'recognition',version:POSE_CONSENT_VERSION,accepted:false});
    return state(false);
  });
  read.resolve(state());await reading;
  assert.equal(saved,true);
  assert.equal(hasPoseConsent(client.getQueryData(key).consents,'recognition'),false);
});

test('a refetch started during the write also cannot overwrite the committed revocation',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  const key=poseConsentKey('owner'),write=deferred(),started=deferred(),read=deferred();let signal;
  client.setQueryData(key,state());
  const saving=change(client,()=>{started.resolve();return write.promise;});
  await started.promise;
  const reading=client.fetchQuery(poseConsentQueryOptions({userId:'owner',scope:'recognition',enabled:true,request:(_,{signal:input})=>{signal=input;return read.promise;}})).catch(error=>error);
  write.resolve(state(false));await saving;
  assert.equal(signal.aborted,true);
  read.resolve(state());await reading;
  assert.equal(hasPoseConsent(client.getQueryData(key).consents,'recognition'),false);
});

test('two scope changes are serialized so whole-account responses preserve both revocations',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  const first=deferred(),second=deferred(),firstStarted=deferred(),secondStarted=deferred(),calls=[];
  const request=(_,{body})=>{
    calls.push(body.scope);
    if(body.scope==='recognition'){firstStarted.resolve();return first.promise;}
    secondStarted.resolve();return second.promise;
  };
  const one=change(client,request),two=change(client,request,{scope:'observation'});
  await firstStarted.promise;assert.deepEqual(calls,['recognition']);
  first.resolve(state(false,true));await one;await secondStarted.promise;
  assert.deepEqual(calls,['recognition','observation']);
  second.resolve(state(false,false));await two;
  assert.deepEqual(client.getQueryData(poseConsentKey('owner')),state(false,false));
});

test('account change respects cache clearing and skips queued writes from the former owner',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  const write=deferred(),started=deferred();let currentOwner='owner',calls=0;
  const request=()=>{calls++;started.resolve();return write.promise;};
  const isCurrent=()=>currentOwner==='owner';
  const one=change(client,request,{isCurrent}),two=change(client,request,{isCurrent,scope:'observation'});
  await started.promise;currentOwner='other';client.clear();
  client.setQueryData(poseConsentKey('other'),state(false,false));
  write.resolve(state(false));
  assert.equal(await one,false);assert.equal(await two,false);assert.equal(calls,1);
  assert.equal(client.getQueryData(poseConsentKey('owner')),undefined);
  assert.deepEqual(client.getQueryData(poseConsentKey('other')),state(false,false));
});

test('a failed write preserves the last confirmed state and releases the queue for retry',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  client.setQueryData(poseConsentKey('owner'),state());
  await assert.rejects(change(client,async()=>{throw new Error('offline');}),/offline/);
  assert.deepEqual(client.getQueryData(poseConsentKey('owner')),state());
  assert.equal(await change(client,async()=>state(false)),true);
  assert.equal(hasPoseConsent(client.getQueryData(poseConsentKey('owner')).consents,'recognition'),false);
});

test('consent queries require a user, an analysis scope and active authentication',()=>{
  const base={userId:'owner',scope:'recognition',enabled:true,request:()=>{}};
  assert.equal(poseConsentQueryOptions(base).enabled,true);
  for(const missing of [{userId:null},{scope:null},{scope:'unknown'},{enabled:false}])assert.equal(poseConsentQueryOptions({...base,...missing}).enabled,false);
});

const view=(client,scope='recognition',query={})=>poseConsentState({userId:'owner',scope,enabled:true,
  query:{isSuccess:true,data:client.getQueryData(poseConsentKey('owner')),...query},changes:client.getQueryData(poseConsentChangesKey('owner'))});

test('unread, failed, declined and accepted choices are distinct; stale accepted data cannot authorize after read failure',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  assert.equal(view(client).status,'unchecked');assert.equal(view(client).ready,false);
  client.setQueryData(poseConsentKey('owner'),{version:POSE_CONSENT_VERSION,consents:[]});
  assert.equal(view(client).status,'not-granted');assert.equal(view(client).ready,true);
  client.setQueryData(poseConsentKey('owner'),state());
  assert.equal(view(client).status,'accepted');
  assert.equal(view(client,'recognition',{isFetching:true}).status,'checking');
  const query=poseConsentQueryOptions({userId:'owner',scope:'recognition',enabled:true,request:async()=>{throw Error('offline');}});
  await assert.rejects(client.fetchQuery(query),/offline/);
  const failed=client.getQueryState(poseConsentKey('owner'));
  const result=view(client,'recognition',{isSuccess:false,isError:failed.status==='error',error:failed.error});
  assert.equal(result.status,'error');assert.equal(result.accepted,false);assert.equal(result.ready,false);assert.equal(result.lastChoice,'accepted');
  assert.notEqual(result.label,'사용 안 함');
  await client.fetchQuery({...query,queryFn:async()=>state(false)});
  assert.equal(view(client).status,'revoked');assert.equal(view(client).accepted,false);
});

test('pending and failed revocation blocks every consumer without pretending the last confirmed acceptance was revoked',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  client.setQueryData(poseConsentKey('owner'),state());
  const write=deferred(),started=deferred();
  const saving=change(client,()=>{started.resolve();return write.promise;});
  await started.promise;
  assert.equal(view(client).status,'revoking');assert.equal(view(client).ready,false);
  assert.equal(view(client,'observation').accepted,true);
  write.reject(Error('offline'));await assert.rejects(saving,/offline/);
  assert.equal(view(client).status,'error');assert.equal(view(client).lastChoice,'accepted');assert.equal(view(client).accepted,false);
  assert.equal(view(client).retryLabel,'사용 중지 다시 시도');
  // A background read confirming the old choice does not cancel a failed stop.
  client.setQueryData(poseConsentKey('owner'),state());assert.equal(view(client).ready,false);
  assert.equal(await change(client,async()=>state(false)),true);
  assert.equal(view(client).status,'revoked');assert.equal(view(client).ready,true);
});

test('a malformed or contradictory grant response never starts analysis or replaces confirmed choices',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  const key=poseConsentKey('owner');client.setQueryData(key,state(false));
  for(const response of [null,{version:POSE_CONSENT_VERSION,consents:null},state(false)]){
    await assert.rejects(change(client,async()=>response,{accepted:true}));
    assert.equal(view(client).ready,false);assert.equal(view(client).accepted,false);
    assert.deepEqual(client.getQueryData(key),state(false));
  }
  assert.equal(await change(client,async()=>state(),{accepted:true}),true);
  assert.equal(view(client).status,'accepted');
});

test('leaving during revocation keeps the stop intention blocked until retried, even if a fresh read still reports acceptance',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  client.setQueryData(poseConsentKey('owner'),state());
  client.setQueryData(poseConsentKey('other'),state(false,false));
  const write=deferred(),started=deferred();let current=true;
  const saving=change(client,()=>{started.resolve();return write.promise;},{isCurrent:()=>current});
  await started.promise;current=false;write.resolve(state(false));assert.equal(await saving,false);
  assert.equal(view(client).status,'unconfirmed');assert.equal(view(client).ready,false);
  // The request may never have reached the server; an old acceptance is not
  // confirmation that the user's requested stop succeeded.
  client.setQueryData(poseConsentKey('owner'),state());
  assert.equal(view(client).status,'unconfirmed');assert.equal(view(client).accepted,false);
  assert.equal(view(client).retryLabel,'사용 중지 다시 시도');
  assert.equal(await change(client,async(_,{body})=>{assert.equal(body.accepted,false);return state(false);}),true);
  assert.equal(view(client).status,'revoked');
  assert.deepEqual(client.getQueryData(poseConsentKey('other')),state(false,false));
});

test('repeated start or stop while a scope change is pending does not enqueue a second write',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  const write=deferred(),started=deferred();let calls=0;
  const request=()=>{calls++;started.resolve();return write.promise;};
  const first=change(client,request);await started.promise;
  assert.equal(await change(client,request),false);assert.equal(calls,1);
  write.resolve(state(false));assert.equal(await first,true);
});

test('invalid reads fail as unavailable, while an older recorded version is not a current grant',async t=>{
  const client=new QueryClient();t.after(()=>client.clear());
  const options=response=>poseConsentQueryOptions({userId:'owner',scope:'recognition',enabled:true,request:async()=>response});
  for(const response of [{},{version:'old',consents:[]},{version:POSE_CONSENT_VERSION,consents:[null]}])await assert.rejects(client.fetchQuery(options(response)),/설정/);
  const previous=state();previous.consents.forEach(row=>row.version='old');
  await client.fetchQuery(options(previous));
  assert.equal(view(client).status,'not-granted');assert.equal(view(client).accepted,false);
});
