import test from 'node:test';
import assert from 'node:assert/strict';
import {saveGpsDraft,finalizeGpsDraft,listGpsDrafts,loadGpsDraft,deleteGpsDraft} from './drafts.js';
const id='7b56055a-ba14-4716-8659-5c57f1290f18';
const track={points:[[37,127,1760000000000],[37.001,127.001,1760000010000]],elapsed:10000,distance:100};
test('draft deletion requires owner, id and unfinished state and rejects missing or failed results', async () => {
  const calls=[]; let response={data:[{id}]}; const q={};
  for(const method of ['delete','eq','is','select'])q[method]=(...args)=>{calls.push([method,...args]);return q;};
  q.then=resolve=>Promise.resolve(resolve(response));
  const db={from:table=>{assert.equal(table,'gps_drafts');return q;}};
  await assert.rejects(deleteGpsDraft(db,'',id));
  await assert.rejects(deleteGpsDraft(db,'owner','bad')); assert.deepEqual(calls,[]);
  await deleteGpsDraft(db,'owner',id);
  assert.deepEqual(calls,[['delete'],['eq','user_id','owner'],['eq','id',id],['is','finalized_at',null],['select','id']]);
  response={data:[]}; await assert.rejects(deleteGpsDraft(db,'owner',id),/이미 삭제/);
  response={error:{message:'network'}}; await assert.rejects(deleteGpsDraft(db,'owner',id),/다시 시도/);
});
test('GPS draft retries keep one measurement id and let the server derive the date and owner',async()=>{
  const calls=[]; const db={rpc:async(name,args)=>{calls.push({name,args});return {data:id};}};
  await saveGpsDraft(db,id,'walking',track,' 메모 '); await saveGpsDraft(db,id,'walking',track,' 메모 ');
  assert.deepEqual(calls[0],calls[1]); assert.equal(calls[0].name,'save_gps_draft');
  assert.equal(calls[0].args.p_note,'메모'); assert.ok(!('user_id' in calls[0].args));assert.ok(!('p_performed_on' in calls[0].args));
});
test('invalid measurement and identifiers make no persistence calls',async()=>{
  const db={rpc:()=>{throw new Error('must not query');}};
  await assert.rejects(saveGpsDraft(db,id,'gym',track,''),/러닝/);
  await assert.rejects(saveGpsDraft(db,'invalid','running',track,''),/식별자/);
  await assert.rejects(finalizeGpsDraft(db,'invalid',''),/측정/);
  assert.equal(await loadGpsDraft(db,'user','invalid'),null);
});
test('finalization only sends draft identity and note, and surfaces missing migrations',async()=>{
  let call; const db={rpc:async(...args)=>{call=args;return {data:42};}};
  assert.equal(await finalizeGpsDraft(db,id,' memo '),'42');assert.deepEqual(call,['finalize_gps_draft',{p_id:id,p_note:'memo'}]);
  await assert.rejects(saveGpsDraft({rpc:async()=>({error:{code:'PGRST202'}})},id,'running',track,''),/DB 업데이트/);
});
test('draft listing scopes to owner, date and sport without loading precise routes',async()=>{
  const calls=[];const q={}; for(const method of ['select','eq','is','order','limit','abortSignal'])q[method]=(...args)=>{calls.push([method,...args]);return q;};
  q.then=resolve=>Promise.resolve(resolve({data:[]}));
  const db={from:table=>{assert.equal(table,'gps_drafts');return q;}};
  await listGpsDrafts(db,'owner',{date:'2026-10-03',sport:'running'});
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner'));
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='performed_on'&&c[2]==='2026-10-03'));
  assert.ok(calls.some(c=>c[0]==='is'&&c[1]==='finalized_at'&&c[2]===null));
  assert.ok(!calls[0][1].includes('points'));
});
