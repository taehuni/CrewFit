import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { matchCrews } from './matching.js';
import { createCrewsRouter } from '../routes/crews.js';
const profile = {main_sport:'running',level:'beginner'};
const settings = {region_sido:'서울',region_sigungu:'중구',preferred_days:[1,3]};
const crew = (id, extra={}) => ({id,owner_id:'other',name:'크루',sport:'running',level:'beginner',region_sido:'서울',region_sigungu:'중구',activity_days:[1],...extra});
function fixture({p=profile,s=settings,crews=[],members=[],fail=null}={}) {
  const reads=[];
  return {reads,db:{from(table){const filters=[];return {
    select(){return this;},eq(key,value){filters.push(row=>row[key]===value);reads.push([table,key,value]);return this;},
    in(key,values){filters.push(row=>values.includes(row[key]));return this;},neq(key,value){filters.push(row=>row[key]!==value);return this;},
    overlaps(key,value){filters.push(row=>row[key].some(day=>value.includes(day)));return this;},order(){return this;},
    async maybeSingle(){return {data:table==='profiles'?p:s,error:fail===table?{}:null};},
    async range(start,end){return {data:(table==='crews'?crews:members).filter(row=>filters.every(fn=>fn(row))).slice(start,end+1),error:fail===table?{}:null};},
  };},async rpc(){return {data:7,error:fail==='rpc'?{}:null};}}};
}
test('strict matches exclude own, approved and pending memberships, return reasons and RPC count',async()=>{
  const {db,reads}=fixture({crews:[crew(1),crew(2),crew(3),crew(4,{owner_id:'me'}),crew(5,{sport:'gym'})],members:[{crew_id:2,user_id:'me'},{crew_id:3,user_id:'me'}]});
  const result=await matchCrews(db,'me');
  assert.deepEqual(result.crews.map(row=>row.id),[1]);
  assert.deepEqual(result.crews[0].matched_on,['sport','region','days','level']);
  assert.equal(result.crews[0].member_count,7);
  assert.deepEqual(result.relaxed,[]);
  assert.ok(reads.some(row=>row.join('/')==='user_settings/user_id/me'));
  assert.ok(reads.some(row=>row.join('/')==='profiles/id/me'));
});
test('relaxes level then days then region, comparing region pair rather than district alone',async()=>{
  for(const [extra,relaxed] of [[{level:null},['level']],[{activity_days:[]},['level','days']],[{region_sido:'부산'},['level','days','region']]]){
    const result=await matchCrews(fixture({crews:[crew(1,extra)]}).db,'me');
    assert.deepEqual(result.relaxed,relaxed);
    assert.equal(result.crews.length,1);
  }
});
test('does not fill strict results with weaker matches or relax sport; unset optional criteria are skipped',async()=>{
  const result=await matchCrews(fixture({crews:[crew(1),crew(2,{level:'advanced'})]}).db,'me');
  assert.equal(result.crews.length,1);
  const empty=await matchCrews(fixture({crews:[crew(3,{sport:'gym'})]}).db,'me');
  assert.equal(empty.crews.length,0);
  const optional=await matchCrews(fixture({p:{main_sport:'running'},s:null,crews:[crew(1)]}).db,'me');
  assert.deepEqual(optional.relaxed,[]);assert.deepEqual(optional.crews[0].matched_on,['sport']);
});
test('paginates memberships and candidates before relaxing and caps recommendation response at 20',async()=>{
  const members=Array.from({length:105},(_,i)=>({crew_id:i+1,user_id:'me'}));
  const result=await matchCrews(fixture({members,crews:Array.from({length:140},(_,i)=>crew(i+1))}).db,'me');
  assert.equal(result.crews.length,20);assert.equal(result.crews[0].id,106);assert.deepEqual(result.relaxed,[]);
});
test('auth, missing sport and partial database errors never become empty success',async()=>{
  await assert.rejects(matchCrews({},null),{status:401});
  await assert.rejects(matchCrews(fixture({p:null}).db,'me'),{status:400,code:'SETTINGS_REQUIRED'});
  for(const fail of ['profiles','user_settings','crew_members','crews','rpc'])
    await assert.rejects(matchCrews(fixture({fail,crews:[crew(1)]}).db,'me'),{status:500});
});
test('match route requires auth and takes caller from verified session rather than query string',async t=>{
  const calls=[],app=express();
  app.use('/api/crews',createCrewsRouter((req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={id:'actual'};req.db={scoped:true};next();},undefined,undefined,async(...args)=>{calls.push(args);return {crews:[],relaxed:[]};}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}/api/crews/match?user_id=victim`;
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{Authorization:'Bearer test'}})).status,200);
  assert.deepEqual(calls,[[{scoped:true},'actual']]);
});

test('multiple interests include either sport; an explicit empty choice explores all sports without false match reasons',async()=>{
 const crews=[crew(1),crew(2,{sport:'gym'}),crew(3,{sport:'swimming'})];
 const multi=await matchCrews(fixture({s:{...settings,interested_sports:['running','gym']},crews}).db,'me');
 assert.deepEqual(multi.crews.map(c=>c.id),[1,2]);
 const any=await matchCrews(fixture({p:{},s:{interested_sports:[]},crews}).db,'me');
 assert.equal(any.crews.length,3);
 assert.ok(any.crews.every(c=>!c.matched_on.includes('sport')));
});
