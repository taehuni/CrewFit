import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPoseSession,normalizePoseObservations,savePoseSession,listPoseSessions} from './poseSessions.js';
const id='1c74fca0-7dab-4015-a34d-250da7e37555';
const valid=()=>({id,measured_on:'2026-11-04',exercise:'squat',view:'side',reps:3,duration_seconds:25,observations:[]});
function mock(results,user='owner'){
 const calls=[];
 const chain={};
 for(const method of ['insert','select','eq','order','limit'])chain[method]=(...args)=>{calls.push([method,...args]);return chain;};
 chain.single=async()=>results.shift();
 chain.then=(resolve,reject)=>Promise.resolve(results.shift()).then(resolve,reject);
 return {calls,auth:{getUser:async()=>({data:{user:user?{id:user}:null}})},from:table=>{calls.push(['from',table]);return chain;}};
}
test('minimal summary payload rejects invalid values and private frame fields',()=>{
 assert.deepEqual(buildPoseSession(valid()),valid());
 for(const extra of [{measured_on:'2026-02-30'},{duration_seconds:0},{duration_seconds:NaN},{reps:1.2},{view:'front'},{exercise:'toString'},{id:'invalid'},{video:'data:video'},{user_id:'other'}])assert.throws(()=>buildPoseSession({...valid(),...extra}));
 assert.equal(buildPoseSession({...valid(),view:'front',reps:null}).reps,null);
});

test('catalogue observations bind to real criteria and other activities have no evaluation',()=>{
 const generic={...valid(),exercise:'leg_press',view:'auto',reps:null,observations:[{key:'criterion_0',label:'지지',message:'몸통 지지를 확인해 주세요.',source_id:'leg_press'}]};
 assert.equal(buildPoseSession(generic).exercise_label,null);
 for(const extra of [{reps:3},{view:'side'},{exercise:'situp'},{exercise_label:'임의'}])assert.throws(()=>buildPoseSession({...generic,...extra}));
 assert.throws(()=>buildPoseSession({...generic,observations:[{...generic.observations[0],source_id:'goblet_squat'}]}));
 assert.throws(()=>buildPoseSession({...generic,observations:[{...generic.observations[0],key:'criterion_99'}]}));
 const manual={...valid(),exercise:'manual_other',view:'manual',reps:null,exercise_label:'  케이블 운동  '};
 assert.equal(buildPoseSession(manual).exercise_label,'케이블 운동');
 for(const extra of [{exercise_label:''},{exercise_label:'x'.repeat(61)},{exercise_label:'a\nb'},{reps:0},{observations:generic.observations}])assert.throws(()=>buildPoseSession({...manual,...extra}));
});

test('older database keeps legacy history and writes while extended writes explain setup',async()=>{
 const absent={code:'42703',message:'column pose_sessions.exercise_label does not exist'};
 const history=mock([{error:absent},{data:[valid()]}]);
 assert.equal((await listPoseSessions({client:history})).length,1);
 const legacy=mock([{error:absent},{data:valid()}]);
 assert.deepEqual(await savePoseSession(valid(),{client:legacy,expectedUserId:'owner'}),valid());
 const extended=mock([{error:absent}]);
 await assert.rejects(savePoseSession({...valid(),exercise:'leg_press',view:'auto',reps:null},{client:extended,expectedUserId:'owner'}),{code:'pose_setup_required',status:503});
 assert.equal(extended.calls.filter(x=>x[0]==='insert').length,1);
});
test('observations are allowlisted and stripped to bounded summary fields',()=>{
 const item={key:'heel',label:'뒤꿈치',message:'발바닥을 확인해 주세요.',landmarks:[1],state:'observe'};
 assert.deepEqual(normalizePoseObservations([item]),[{key:'heel',label:item.label,message:item.message}]);
 assert.throws(()=>normalizePoseObservations([item,item]));
 assert.throws(()=>normalizePoseObservations([{...item,key:'video'}]));
 assert.throws(()=>buildPoseSession({...valid(),observations:[{...item,key:'leftKnee'}]}));
});
test('save uses authenticated owner and only selected summary fields',async()=>{
 const client=mock([{data:valid(),error:null}]);
 assert.deepEqual(await savePoseSession(valid(),{client,expectedUserId:'owner'}),valid());
 assert.equal(client.calls.find(([method])=>method==='insert')[1].user_id,'owner');
});
test('stable ID retry reads existing owner row without update',async()=>{
 const client=mock([{error:{code:'23505'}},{data:valid(),error:null}]);
 assert.deepEqual(await savePoseSession(valid(),{client,expectedUserId:'owner'}),valid());
 assert.ok(client.calls.some(call=>call[0]==='eq'&&call[1]==='user_id'&&call[2]==='owner'));
 assert.ok(client.calls.some(call=>call[0]==='eq'&&call[1]==='id'&&call[2]===id));
});

test('same ID with changed summary is a conflict instead of false success',async()=>{
 const client=mock([{error:{code:'23505'}},{data:{...valid(),duration_seconds:100},error:null}]);
 await assert.rejects(savePoseSession(valid(),{client,expectedUserId:'owner'}),{code:'pose_conflict',status:409});
});
test('signed-out and switched accounts cannot write',async()=>{
 for(const user of [null,'other']){
  const client=mock([],user);
  await assert.rejects(savePoseSession(valid(),{client,expectedUserId:'owner'}));
  assert.equal(client.calls.length,0);
 }
});
test('permission and network failures propagate without hiding save errors',async()=>{
 const error={code:'42501',message:'denied'},client=mock([{error}]);
 await assert.rejects(savePoseSession(valid(),{client,expectedUserId:'owner'}),err=>err===error);
 assert.equal(client.calls.filter(call=>call[0]==='from').length,1);
});
test('history is owner-filtered, limited and deterministically sorted',async()=>{
 const client=mock([{data:[valid()],error:null}]);
 assert.equal((await listPoseSessions({client})).length,1);
 assert.deepEqual(client.calls.filter(call=>call[0]==='order').map(call=>call[1]),['measured_on','created_at','id']);
 assert.ok(client.calls.some(call=>call[0]==='eq'&&call[1]==='user_id'&&call[2]==='owner'));
 await assert.rejects(listPoseSessions({client,limit:101}));
});
test('history refuses changed account before querying to prevent cross-account cache results',async()=>{
 const client=mock([],'other');
 await assert.rejects(listPoseSessions({client,expectedUserId:'owner'}),/로그인 계정이 바뀌었어요/);
 assert.equal(client.calls.length,0);
 const matching=mock([{data:[valid()],error:null}],'owner');
 assert.equal((await listPoseSessions({client:matching,expectedUserId:'owner'})).length,1);
});
