import test from 'node:test';
import assert from 'node:assert/strict';
import {preferenceInput,saveCrewPreferences} from './crewPreferences.js';
const form={interested_sports:['gym'],level:'',region_sido:'',region_sigungu:'',preferred_days:[3,1,3]};
test('recommendation preferences normalize optional fields and reject invalid sport, region pair and days',()=>{
  assert.deepEqual(preferenceInput(form,[]),{profile:{level:null},settings:{interested_sports:['gym'],region_sido:null,region_sigungu:null,preferred_days:[1,3]}});
  for(const extra of [{interested_sports:['invalid']},{level:'elite'},{region_sido:'서울'},{preferred_days:[7]},{preferred_days:['1']}])assert.throws(()=>preferenceInput({...form,...extra},[]));
});
test('preference writes are scoped to caller and only matching fields; partial save is explicit',async()=>{
  const calls=[];let fail=false;
  const db={from(table){return {update(row){calls.push([table,row]);return this;},eq(...args){calls.push(args);return this;},select(){return this;},async single(){return fail&&table==='user_settings'?{error:{}}:{data:{id:'me'}};}};}};
  await saveCrewPreferences(db,'me',form,[]);
  assert.ok(calls.some(row=>JSON.stringify(row)==='["id","me"]'));
  assert.ok(calls.some(row=>JSON.stringify(row)==='["user_id","me"]'));
  fail=true;await assert.rejects(saveCrewPreferences(db,'me',form,[]),/운동 레벨은 저장됐지만/);
  await assert.rejects(saveCrewPreferences({},null,form,[]));
});

test('beginners can save no interests and multiple interests are deduplicated',()=>{
 assert.deepEqual(preferenceInput({...form,interested_sports:[]},[]).settings.interested_sports,[]);
 assert.deepEqual(preferenceInput({...form,interested_sports:['gym','running','gym']},[]).settings.interested_sports,['gym','running']);
 assert.equal('main_sport' in preferenceInput(form,[]).profile,false);
});
