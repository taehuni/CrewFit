import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBody,listBody,createBody,updateBody,deleteBody} from './body.js';
const owner='c4f083ed-3481-44c5-a589-771f7e330f52',other='4b759c19-c70f-4e41-8180-a5dbf3d90975',id='45cf3bf5-ea83-4f9e-a5d8-ec3929558f83';
const values={measured_on:'2026-11-02',weight_kg:70.25,skeletal_muscle_kg:29.5,body_fat_percent:20.2,note:'같은 시간에 측정',source_label:'직접 입력'};
function memory(initial=[]){
 const rows=structuredClone(initial),calls=[];
 return {rows,calls,from(table){assert.equal(table,'body_measurements');let action='read',body,limit=Infinity;const filters=[];const call={filters};calls.push(call);
  const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},order(){return query;},limit(n){limit=n;return query;},insert(value){action='insert';body=value;call.body=value;return query;},update(value){action='update';body=value;call.body=value;return query;},delete(){action='delete';return query;},single(){return run(true);},maybeSingle(){return run(true);},then(resolve,reject){return run(false).then(resolve,reject);}};
  async function run(single){call.action=action;if(action==='insert'){if(rows.some(row=>row.id===body.id))return {data:null,error:{code:'23505'}};rows.push({...body,created_at:'2026-11-02T10:00:00Z'});return {data:rows.at(-1),error:null};}
   const found=rows.filter(row=>filters.every(([key,value])=>row[key]===value)).slice(0,limit);
   if(action==='update')found.forEach(row=>Object.assign(row,body));if(action==='delete')found.forEach(row=>rows.splice(rows.indexOf(row),1));
   return {data:single?found[0]||null:found,error:null};}
  return query;
 }};
}
test('body validation rejects impossible dates, wrong types, ranges and muscle greater than weight',()=>{
 assert.deepEqual(validateBody(values),values);
 for(const patch of [{measured_on:'2026-02-30'},{measured_on:'1999-12-31'},{weight_kg:'70'},{weight_kg:NaN},{weight_kg:501},{weight_kg:0},{weight_kg:70.123},{skeletal_muscle_kg:80},{body_fat_percent:101},{body_fat_percent:-1},{note:'x'.repeat(501)},{source_label:'x'.repeat(61)}])assert.throws(()=>validateBody({...values,...patch}),error=>error.status===400);
 assert.equal(validateBody({...values,skeletal_muscle_kg:null,body_fat_percent:null}).skeletal_muscle_kg,null);
 assert.equal(validateBody({...values,skeletal_muscle_kg:0,body_fat_percent:0}).body_fat_percent,0);
});
test('creation ignores caller ownership, retries identical request without duplicating and rejects changed payload',async()=>{
 const db=memory();const first=await createBody(db,owner,{...values,id,user_id:other});
 assert.equal(first.user_id,owner);assert.equal((await createBody(db,owner,{...values,id})).id,id);assert.equal(db.rows.length,1);
 await assert.rejects(createBody(db,owner,{...values,id,weight_kg:71}),e=>e.status===409);assert.equal(db.rows[0].weight_kg,70.25);
});
test('foreign UUID collisions cannot disclose or overwrite another user measurement',async()=>{
 const db=memory([{...values,id,user_id:other}]);
 await assert.rejects(createBody(db,owner,{...values,id}),e=>e.status===409);
 await assert.rejects(updateBody(db,owner,id,{...values,weight_kg:72}),e=>e.status===404);
 await assert.rejects(deleteBody(db,owner,id),e=>e.status===404);
 assert.deepEqual(await listBody(db,owner),{rows:[],hasMore:false});assert.equal(db.rows[0].weight_kg,70.25);
 for(const call of db.calls.filter(call=>call.action!=='insert'))assert.ok(call.filters.some(([key,value])=>key==='user_id'&&value===owner));
});
test('update and deletion affect only the authenticated owner and preserve immutable identifiers',async()=>{
 const db=memory([{...values,id,user_id:owner}]);
 const updated=await updateBody(db,owner,id,{...values,weight_kg:71,user_id:other,id:'ignored'});
 assert.equal(updated.id,id);assert.equal(updated.user_id,owner);assert.equal(updated.weight_kg,71);
 assert.deepEqual(await deleteBody(db,owner,id),{ok:true});assert.equal(db.rows.length,0);
});
test('list returns first 100 rows and exposes truncation explicitly',async()=>{
 const db=memory(Array.from({length:102},(_,n)=>({...values,id:String(n),user_id:owner})));
 const result=await listBody(db,owner);assert.equal(result.rows.length,100);assert.equal(result.hasMore,true);
});
