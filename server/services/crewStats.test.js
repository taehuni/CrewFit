import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { loadCrewStats } from './crewStats.js';
import { createCrewsRouter } from '../routes/crews.js';
const now = new Date('2026-09-27T15:30:00Z'); // Monday in KST, Sunday in UTC.
const row = (id,user,visibility='crew',status='approved',crewId=15) => ({id,user_id:user,distance_m:1000,duration_sec:600,
  profiles:{activity_visibility:visibility,crew_members:[{crew_id:crewId,status}]}});
function fixture({rows=[],missing=false,crewError=false,failPage=-1,cap=2}={}) {
  const calls=[];
  const db={from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:missing?null:{id:15},error:crewError?{}:null};}};}};
  let page=0;
  const admin={from(table){let cursor=0;calls.push(['from',table]);return {
    select(...args){calls.push(['select',...args]);return this;},
    in(...args){calls.push(['in',...args]);return this;},eq(...args){calls.push(['eq',...args]);return this;},
    gte(...args){calls.push(['gte',...args]);return this;},lte(...args){calls.push(['lte',...args]);return this;},
    order(){return this;},limit(){return this;},gt(key,value){cursor=Number(value);return this;},
    then(resolve){return Promise.resolve({data:rows.filter(r=>r.id>cursor).slice(0,cap),error:page++===failPage?{}:null}).then(resolve);},
  };}};
  return {db,admin,calls};
}
test('only approved non-private contributors count; under three returns no aggregate or identities',async()=>{
  for(const rows of [[],[row(1,'a'),row(2,'a'),row(3,'b'),row(4,'private','private'),row(5,'pending','public','pending'),row(6,'other','crew','approved',16)]]){
    const {db,admin}=fixture({rows});
    assert.deepEqual(await loadCrewStats(db,'viewer','15','week',{admin,now}),{hidden:true,reason:'MIN_MEMBERS'});
  }
});
test('three distinct eligible contributors reveals ONLY totals; all pages and null distance are handled',async()=>{
  const {db,admin,calls}=fixture({rows:[row(1,'a'),row(2,'b','public'),row(3,'c'),{...row(4,'c'),distance_m:null}]});
  assert.deepEqual(await loadCrewStats(db,'outsider','15','week',{admin,now}),{
    period:'week',period_start:'2026-09-28',period_end:'2026-10-04',distance_m:3000,duration_sec:2400,activity_count:4,contributing_members:3,
  });
  for(const expected of [['in','profiles.activity_visibility',['public','crew']],['eq','profiles.crew_members.crew_id','15'],['eq','profiles.crew_members.status','approved'],['gte','performed_on','2026-09-28'],['lte','performed_on','2026-10-04']])
    assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(expected)));
  assert.ok(calls.filter(call=>call[0]==='from').length>=3);
  assert.match(calls.find(call=>call[0]==='select')[1],/profiles!inner.*crew_members!inner/);
});
test('monthly dates cover leap February in KST',async()=>{
  const {db,admin}=fixture({rows:[row(1,'a'),row(2,'b'),row(3,'c')]});
  const result=await loadCrewStats(db,'me','15','month',{admin,now:new Date('2024-01-31T15:00:00Z')});
  assert.equal(result.period_start,'2024-02-01');assert.equal(result.period_end,'2024-02-29');
});
test('invalid input, missing crew, and partial query errors fail rather than reveal partial totals',async()=>{
  await assert.rejects(loadCrewStats({},null,'15'),{status:401});
  for(const id of ['x','0','-1','9223372036854775808'])await assert.rejects(loadCrewStats({},'me',id),{status:400});
  await assert.rejects(loadCrewStats({},'me','15','day'),{status:400});
  const missing=fixture({missing:true});await assert.rejects(loadCrewStats(missing.db,'me','15'),{status:404});
  const broken=fixture({crewError:true});await assert.rejects(loadCrewStats(broken.db,'me','15'),{status:500});
  const partial=fixture({rows:[row(1,'a'),row(2,'b'),row(3,'c')],failPage:1});
  await assert.rejects(loadCrewStats(partial.db,'me','15','week',{admin:partial.admin,now}),{status:500});
});
test('stats route authenticates, forwards only period and crew id, and disables HTTP caching',async t=>{
  const calls=[],app=express();
  app.use('/api/crews',createCrewsRouter((req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={id:'actual'};req.db={scoped:true};next();},undefined,undefined,undefined,async(...args)=>{calls.push(args);return {hidden:true,reason:'MIN_MEMBERS'};}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}/api/crews/15/stats?period=month&user_id=victim&sport=gym`;
  assert.equal((await fetch(url)).status,401);
  const response=await fetch(url,{headers:{Authorization:'Bearer test'}});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(calls,[[{scoped:true},'actual','15','month']]);
});
