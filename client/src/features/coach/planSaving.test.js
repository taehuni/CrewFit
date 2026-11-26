import test from 'node:test';
import assert from 'node:assert/strict';
import {QueryClient,QueryObserver} from '@tanstack/react-query';
import {persistWorkoutPlans,refreshSavedWorkoutPlans} from './planSaving.js';
test('plan saving returns confirmed rows without fetching history or Calendar',async()=>{
 let calls=0;
 const rows=[{id:'plan',turn_id:'turn',position:0}];
 assert.equal(await persistWorkoutPlans(async options=>{calls++;assert.deepEqual(options.body,{turn_id:'turn',items:[{position:0}]});return rows;},'turn',[{position:0}]),rows);
 assert.equal(calls,1);
});
test('plan saving rejects incomplete confirmation and preserves server errors',async()=>{
 await assert.rejects(persistWorkoutPlans(async()=>[],'turn',[{position:0}]),/저장 결과/);
 await assert.rejects(persistWorkoutPlans(async()=>{throw new Error('권한 없음');},'turn',[{position:0}]),/권한 없음/);
});
test('unresponsive save is aborted and gives retry guidance',async()=>{
 await assert.rejects(persistWorkoutPlans(({signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))),'turn',[{position:0}],10),/중복 저장되지/);
});

test('saving a reviewed proposal refreshes the recent conversation within cache age and isolates other accounts', {timeout:2000}, async t=>{
 const client=new QueryClient({defaultOptions:{queries:{staleTime:30_000,retry:false,refetchOnWindowFocus:false}}});
 t.after(()=>client.clear());
 let serverPlans=[],recentReads=0,onReturn;
 const options=view=>({queryKey:['coach','owner',view],queryFn:async()=>{
  if(view==='recent')recentReads++;
  return {turns:[{id:'turn'}],plans:[...serverPlans]};
 }});
 const otherKey=['coach','other','recent'],otherPlansKey=['workout-plans','other','2026-11'];
 const other={turns:[{id:'other-turn'}],plans:[]};
 client.setQueryData(otherKey,other);client.setQueryData(otherPlansKey,[]);
 const todayKey=['coach','owner','today','2026-11-26'],plansKey=['workout-plans','owner','2026-11'];
 client.setQueryData(todayKey,{plans:[],count:0});client.setQueryData(plansKey,[]);
 const observer=new QueryObserver(client,options('recent'));
 const unsubscribe=observer.subscribe(result=>{
  if(!result.isFetching&&result.data?.plans.some(plan=>plan.id==='saved'))onReturn?.(result);
 });
 t.after(()=>{unsubscribe();observer.destroy();});
 await observer.refetch();
 observer.setOptions(options('turn'));await observer.refetch();
 const saved={id:'saved',turn_id:'turn',position:0,scheduled_on:'2026-11-26'};
 serverPlans=[saved];
 await refreshSavedWorkoutPlans(client,'owner',options('turn').queryKey,[saved]);
 assert.deepEqual(observer.getCurrentResult().data.plans,[saved]);
 assert.equal(client.getQueryState(todayKey).isInvalidated,true);
 assert.equal(client.getQueryState(plansKey).isInvalidated,true);
 assert.equal(client.getQueryData(otherKey),other);
 assert.equal(client.getQueryState(otherKey).isInvalidated,false);
 assert.equal(client.getQueryState(otherPlansKey).isInvalidated,false);
 const returned=new Promise(resolve=>{onReturn=resolve;});
 observer.setOptions(options('recent'));
 const result=await returned;
 assert.equal(recentReads,2);
 assert.deepEqual(result.data.plans,[saved]);
});
