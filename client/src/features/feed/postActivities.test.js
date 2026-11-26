import test from 'node:test';
import assert from 'node:assert/strict';
import {attachmentChoices,hasOwnAttachmentRoute,ownAttachment,sharedAttachment} from './postActivities.js';
import {savePost} from './posts.js';
function mock({post={activity_id:7},activity={id:7,sport:'gym'},sets=[{id:1,exercise_name:'스쿼트',reps:0,weight_kg:0}],route=null,routeError=null,error=null}={}) {
  const calls=[];
  return {calls,db:{from(table){let cursor=null;return {
    select(fields){calls.push([table,'select',fields]);return this;},eq(...args){calls.push([table,...args]);return this;},order(){return this;},limit(){return this;},lt(){return this;},gt(key,value){cursor=value;return this;},
    insert(row){calls.push(['insert',row]);return this;},update(row){calls.push(['update',row]);return this;},
    async maybeSingle(){return {data:table==='posts'?post:table==='activity_routes'?route:activity,error:table==='activity_routes'?routeError:error};},
    then(resolve){return Promise.resolve({data:table==='exercise_sets'?(cursor?[]:sets):[activity],error}).then(resolve);},
  };}}};
}
test('picker and save verification filter authenticated owner; missing and other-owned records reject',async()=>{
  const {db,calls}=mock();await attachmentChoices(db,'me');await ownAttachment(db,'me','7');
  assert.equal(calls.filter(c=>c[0]==='activities'&&c[1]==='user_id'&&c[2]==='me').length,2);
  await assert.rejects(ownAttachment({},'me','bad'));
  await assert.rejects(ownAttachment(mock({activity:null}).db,'me','7'));
});
test('route sharing availability requires an owned outdoor record and a saved route without reading coordinates',async()=>{
  const found=mock({activity:{id:7,sport:'running'},route:{activity_id:7}});
  assert.equal(await hasOwnAttachmentRoute(found.db,'me','7'),true);
  assert.ok(found.calls.some(c=>c[0]==='activities'&&c[1]==='user_id'&&c[2]==='me'));
  assert.deepEqual(found.calls.filter(c=>c[0]==='activity_routes'),[
    ['activity_routes','select','activity_id'],['activity_routes','activity_id',7],
  ]);
  for(const sport of ['gym','swimming','other']){
    const nonGps=mock({activity:{id:7,sport},route:{activity_id:7}});
    assert.equal(await hasOwnAttachmentRoute(nonGps.db,'me','7'),false);
    assert.ok(!nonGps.calls.some(c=>c[0]==='activity_routes'));
  }
  assert.equal(await hasOwnAttachmentRoute(mock({activity:{id:7,sport:'walking'}}).db,'me','7'),false);
});
test('route availability fails closed on missing ownership, malformed ids and lookup failures',async()=>{
  const unavailable=mock({activity:null,route:{activity_id:7}});
  await assert.rejects(hasOwnAttachmentRoute(unavailable.db,'me','7'));
  assert.ok(!unavailable.calls.some(c=>c[0]==='activity_routes'));
  await assert.rejects(hasOwnAttachmentRoute({},'me','bad'));
  await assert.rejects(hasOwnAttachmentRoute({},null,'7'));
  await assert.rejects(hasOwnAttachmentRoute(mock({activity:{id:7,sport:'cycling'},routeError:{message:'private database error'}}).db,'me','7'),/GPS 경로를 확인하지 못했어요/);
});
test('shared attachment checks visible post first, never requests routes or notes, pages gym sets',async()=>{
  const {db,calls}=mock();const result=await sharedAttachment(db,'3');
  assert.equal(result.sets.length,1);assert.equal(result.sets[0].reps,0);
  assert.deepEqual(calls[0],['posts','select','activity_id']);
  assert.ok(!calls.some(c=>c[0]==='activity_routes'||String(c[2]).includes('note')));
  const unavailable=mock({post:null});assert.equal(await sharedAttachment(unavailable.db,'3'),null);
  assert.ok(unavailable.calls.every(c=>c[0]==='posts'));
});
test('running attachment has no sets and partial errors reject',async()=>{
  const {db,calls}=mock({activity:{id:7,sport:'running',distance_m:5000}});
  assert.deepEqual((await sharedAttachment(db,'3')).sets,[]);assert.ok(!calls.some(c=>c[0]==='exercise_sets'));
  await assert.rejects(sharedAttachment(mock({error:{}}).db,'3'));
});
test('attachment save validates ownership, derives sport, disables route and supports detach',async()=>{
  const form={content:'인증',kind:'log',visibility:'public',sport:'running'};
  const {db,calls}=mock({post:{id:3}});await savePost(db,'me',form,null,null,undefined,'7');
  const input=calls.find(c=>c[0]==='insert')[1];assert.equal(input.sport,'gym');assert.equal(input.activity_id,'7');assert.equal(input.include_route,false);
  const detached=mock({post:{id:3}});await savePost(detached.db,'me',form,null,null,undefined,null);
  assert.equal(detached.calls.find(c=>c[0]==='insert')[1].activity_id,null);
  const missing=mock({activity:null});await assert.rejects(savePost(missing.db,'me',form,null,null,undefined,'7'));
  assert.ok(!missing.calls.some(c=>c[0]==='insert'));
});
