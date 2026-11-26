import test from 'node:test';
import assert from 'node:assert/strict';
import {QueryClient,QueryObserver,onlineManager} from '@tanstack/react-query';
import {PROFILE_CHECK_TIMEOUT_MS,loadRequiredProfile,requiredProfileQuery,requiredProfileError} from './requiredProfile.js';
import {needsProfileCompletion} from './profileCompletion.js';

const complete={profile:{nickname:'러너'},settings:{real_name:'회원'}};
function clock(){let next=0;const pending=new Map();return {schedule(fn,delay){assert.equal(delay,PROFILE_CHECK_TIMEOUT_MS);pending.set(++next,fn);return next;},cancel(id){pending.delete(id);},expire(){for(const fn of [...pending.values()])fn();},get size(){return pending.size;}};}

test('a completed request preserves required fields and cleans up its deadline',async()=>{
 const timer=clock();let received;
 const data=await loadRequiredProfile(async(path,options)=>{assert.equal(path,'/me');received=options;return complete;},{token:'mock-token',...timer});
 assert.equal(data,complete);assert.equal(received.token,'mock-token');assert.equal(received.signal.aborted,false);assert.equal(timer.size,0);
});

test('a stalled transport times out even if it ignores abort, and late data cannot reopen it',async()=>{
 const timer=clock();let received,finish;
 const pending=loadRequiredProfile((path,options)=>{received=options;return new Promise(resolve=>{finish=resolve;});},{...timer});
 const rejection=assert.rejects(pending,{code:'profile_check_timeout'});
 await Promise.resolve();assert.equal(timer.size,1);timer.expire();await rejection;
 assert.equal(received.signal.aborted,true);assert.equal(timer.size,0);
 finish(complete);await Promise.resolve();await assert.rejects(pending,{code:'profile_check_timeout'});
 // An explicit retry has its own live controller and can complete normally.
 assert.equal(await loadRequiredProfile(async(path,options)=>{assert.equal(options.signal.aborted,false);return complete;},{...timer}),complete);
});

test('cancellation aborts an in-flight request, removes the deadline, and blocks late success',async()=>{
 const timer=clock(),parent=new AbortController();let signal,finish;
 const pending=loadRequiredProfile((path,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve;});},{signal:parent.signal,...timer});
 const rejection=assert.rejects(pending,{name:'AbortError'});await Promise.resolve();parent.abort();await rejection;
 assert.equal(signal.aborted,true);assert.equal(timer.size,0);finish(complete);await Promise.resolve();
 await assert.rejects(pending,{name:'AbortError'});
});

test('an already canceled request never calls the API or starts a timer',async()=>{
 const timer=clock(),parent=new AbortController();parent.abort();
 await assert.rejects(loadRequiredProfile(()=>assert.fail('canceled request must not run'),{signal:parent.signal,...timer}),{name:'AbortError'});assert.equal(timer.size,0);
});

test('failed or malformed responses do not supply fallback member data or skip required fields',async()=>{
 for(const value of [null,{}, {profile:null},{profile:[]},{profile:'invalid'},{profile:{nickname:42},settings:{real_name:'회원'}},{profile:{nickname:'러너'},settings:[]},{profile:{nickname:'러너'},settings:{real_name:{}}}])await assert.rejects(loadRequiredProfile(async()=>value),{code:'profile_response_invalid'});
 const failed=Object.assign(new Error('internal transport detail'),{status:503});
 await assert.rejects(loadRequiredProfile(async()=>{throw failed;}),error=>error===failed);
 assert.doesNotMatch(requiredProfileError(failed),/internal transport detail/);
 const missing=await loadRequiredProfile(async()=>({profile:{nickname:''},settings:{real_name:null}}));
 assert.equal(needsProfileCompletion({identities:[{provider:'google'}]},missing),true);
 assert.equal(needsProfileCompletion({identities:[{provider:'google'}]},complete),false);
});

test('offline profile queries attempt the bounded check instead of remaining paused indefinitely',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity}}});const wasOnline=onlineManager.isOnline();onlineManager.setOnline(false);
 let calls=0;
 try{
  const options=requiredProfileQuery(async()=>{calls++;throw new TypeError('offline');},{userId:'member-a',token:'mock-token'});
  await assert.rejects(client.fetchQuery(options),{message:'offline'});
  assert.equal(calls,1);assert.equal(client.getQueryState(options.queryKey).fetchStatus,'idle');assert.equal(client.getQueryState(options.queryKey).status,'error');
 }finally{onlineManager.setOnline(wasOnline);client.clear();}
});

test('query cancellation reaches the request and account keys remain isolated',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity}}});let signal;
 const options=requiredProfileQuery((path,request)=>{signal=request.signal;return new Promise(()=>{});},{userId:'member-a',token:'mock-token'});
 assert.notDeepEqual(options.queryKey,requiredProfileQuery(()=>{}, {userId:'member-b',token:'mock-token'}).queryKey);
 const observer=new QueryObserver(client,options),unsubscribe=observer.subscribe(()=>{});
 try{await Promise.resolve();assert.equal(signal.aborted,false);await client.cancelQueries({queryKey:options.queryKey,exact:true});assert.equal(signal.aborted,true);assert.equal(client.getQueryData(options.queryKey),undefined);}
 finally{unsubscribe();observer.destroy();client.clear();}
});

test('cached data from another profile observer is validated before the gate consumes it',()=>{
 const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity}}});
 const options=requiredProfileQuery(()=>assert.fail('disabled query must not fetch'),{userId:'member-a',token:'mock-token',enabled:false});
 client.setQueryData(options.queryKey,complete);
 const observer=new QueryObserver(client,options),unsubscribe=observer.subscribe(()=>{});
 try{
  assert.equal(observer.getCurrentResult().isSuccess,true);
  client.setQueryData(options.queryKey,{profile:{nickname:42},settings:{real_name:'회원'}});
  assert.equal(observer.getCurrentResult().isError,true);assert.equal(observer.getCurrentResult().error.code,'profile_response_invalid');
  client.setQueryData(options.queryKey,complete);assert.equal(observer.getCurrentResult().isSuccess,true);
 }finally{unsubscribe();observer.destroy();client.clear();}
});
