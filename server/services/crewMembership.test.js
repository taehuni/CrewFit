import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { joinCrew } from './crewMembership.js';
import { createCrewsRouter } from '../routes/crews.js';

function mock({mode='open',existing=null,missing=false,insertError=null}={}){
  const calls=[];let reads=0;
  const db={from(table){let inserted=false;return {
    select(){return this;},eq(...args){calls.push([table,...args]);return this;},
    async maybeSingle(){return {data:table==='crews' ? (missing?null:{join_mode:mode}) : (++reads>1 && insertError?.code==='23505'?{status:'approved'}:existing)};},
    insert(row){inserted=row;calls.push(row);return this;},async single(){return {data:inserted?{status:inserted.status}:null,error:insertError};}
  };}};return {db,calls};
}
test('join derives status from crew and inserts only authenticated member without posting rights',async()=>{
  for(const mode of ['open','approval']){
    const {db,calls}=mock({mode});const expected=mode==='open'?'approved':'pending';
    assert.deepEqual(await joinCrew(db,'owner','15'),{status:expected});
    assert.ok(calls.some(c=>c.user_id==='owner' && c.crew_id==='15' && c.status===expected && c.can_post===false));
  }
});
test('existing membership and concurrent duplicate return existing state without upsert',async()=>{
  const first=mock({existing:{status:'pending'}});
  assert.deepEqual(await joinCrew(first.db,'owner','15'),{status:'pending'});assert.ok(!first.calls.some(c=>c.can_post===false));
  const race=mock({insertError:{code:'23505'}});
  assert.deepEqual(await joinCrew(race.db,'owner','15'),{status:'approved'});
});
test('invalid ids, deleted crew and policy errors have stable failures',async()=>{
  for(const id of ['0','-1','x','9223372036854775808']) await assert.rejects(joinCrew({},'owner',id),e=>e.status===400);
  await assert.rejects(joinCrew({},null,'1'),e=>e.status===401);
  await assert.rejects(joinCrew(mock({missing:true}).db,'owner','1'),e=>e.status===404);
  await assert.rejects(joinCrew(mock({insertError:{code:'42501'}}).db,'owner','1'),e=>e.status===409);
  await assert.rejects(joinCrew(mock({insertError:{code:'other'}}).db,'owner','1'),e=>e.status===500);
});
test('HTTP join ignores requested user/status and requires authentication',async t=>{
  const calls=[];const app=express();app.use(express.json());
  app.use('/api/crews',createCrewsRouter((req,res,next)=>{if(req.headers.authorization!=='Bearer test')return res.sendStatus(401);req.user={id:'actual'};req.db={scoped:true};next();},async(...args)=>{calls.push(args);return {status:'pending'};}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}/api/crews/15/join`;
  assert.equal((await fetch(url,{method:'POST'})).status,401);
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({user_id:'victim',status:'approved',can_post:true})});
  assert.equal(response.status,200);assert.deepEqual(calls,[[{scoped:true},'actual','15']]);
});
