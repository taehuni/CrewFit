import test from 'node:test';
import assert from 'node:assert/strict';
import { crewInput, createCrew, dayLabel, validCrewId, loadCrews, loadRegions, loadCrew } from './crews.js';
const regions = [{sido:'서울',sigungu:'마포구'}];
const form = {name:' 크루 이름 ',description:' 소개 ',sport:'running',level:'',region_sido:'서울',region_sigungu:'마포구',activity_days:[3,1,3],join_mode:'open',owner_id:'other'};
test('crew form trims, validates region pair and enumerations, strips supplied owner',()=>{
  const row=crewInput(form,regions);
  assert.equal(row.name,'크루 이름'); assert.deepEqual(row.activity_days,[1,3]); assert.equal(row.level,null); assert.equal('owner_id' in row,false);
  for(const patch of [{name:' '},{name:'a'.repeat(41)},{description:'x'.repeat(1001)},{sport:'unknown'},{level:'elite'},{join_mode:'bad'},{region_sigungu:'강남구'},{activity_days:[7]},{activity_days:['1']}]) assert.throws(()=>crewInput({...form,...patch},regions));
  assert.equal(dayLabel([]),'요일 협의'); assert.equal(dayLabel([0,6]),'일 · 토');
});
test('creation uses authenticated owner and preserves errors instead of returning false success',async()=>{
  let inserted;
  const db={from(name){assert.equal(name,'crews');return this;},insert(row){inserted=row;return this;},select(){return this;},single:async()=>({data:{id:5}})};
  assert.equal((await createCrew(db,'owner',form,regions)).id,5); assert.equal(inserted.owner_id,'owner');
  db.single=async()=>({error:new Error('private')});
  await assert.rejects(createCrew(db,'owner',form,regions),/목록을 확인/);
  await assert.rejects(createCrew(db,null,form,regions),/로그인/);
});
test('crew list filters by sport with stable descending cursor',async()=>{
  const calls=[];
  const q={select(){return this;},order(...a){calls.push(a);return this;},limit(n){calls.push(n);return this;},eq(...a){calls.push(a);return this;},lt(...a){calls.push(a);return this;},then(resolve){return Promise.resolve({data:[{id:8}]}).then(resolve);}};
  const page=await loadCrews({from:()=>q},'gym',10);
  assert.equal(page.nextCursor,8); assert.deepEqual(calls,[['id',{ascending:false}],20,['sport','gym'],['id',10]]);
});
test('region pagination continues through server row caps until empty',async()=>{
  const pages=[[{sido:'서울',sigungu:'마포구'}],[{sido:'서울',sigungu:'강남구'}],[]], offsets=[];
  const q={select(){return this;},order(){return this;},range(start){offsets.push(start);return Promise.resolve({data:pages.shift()});}};
  assert.equal((await loadRegions({from:()=>q})).length,2);assert.deepEqual(offsets,[0,1,2]);
});
test('invalid and missing detail IDs skip auxiliary queries',async()=>{
  for(const id of ['0','-1','abc','1 OR 1','9223372036854775808']) {assert.equal(validCrewId(id),false);assert.equal(await loadCrew({},id,'owner'),null);}
  assert.equal(validCrewId('9223372036854775807'),true);
  const q={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null})};
  assert.equal(await loadCrew({from:()=>q},'1','owner'),null);
});
test('detail uses member-count RPC and only reads current user membership',async()=>{
  const calls=[];const data={crews:{id:1,owner_id:'leader'},profiles:{nickname:'리더'},crew_members:{status:'approved'}};
  const db={from(table){return {select(){return this;},eq(...a){calls.push([table,...a]);return this;},maybeSingle:async()=>({data:data[table]})};},rpc:async(name,args)=>{assert.equal(name,'crew_member_count');assert.deepEqual(args,{p_crew_id:'1'});return {data:3};}};
  const row=await loadCrew(db,'1','viewer');assert.equal(row.member_count,3);assert.equal(row.membership,'approved');
  assert.ok(calls.some(c=>JSON.stringify(c)===JSON.stringify(['crew_members','user_id','viewer'])));
});
