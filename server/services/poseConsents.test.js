import test from 'node:test';
import assert from 'node:assert/strict';
import {createPoseConsents} from './poseConsents.js';
import {POSE_CONSENT_VERSION as version} from '../../shared/poseConsent.js';
function database(){
 const rows=[];
 return {rows,from(name){assert.equal(name,'pose_analysis_consents');let filters=[],patch=null;const query={select(){return query;},eq(key,value){filters.push(row=>row[key]===value);return query;},update(value){patch=value;return query;},upsert(row){const previous=rows.find(r=>r.user_id===row.user_id&&r.scope===row.scope&&r.version===row.version);if(previous)Object.assign(previous,row);else rows.push({...row});return Promise.resolve({error:null});},then(resolve){const matches=rows.filter(row=>filters.every(filter=>filter(row)));if(patch)matches.forEach(row=>Object.assign(row,patch));return Promise.resolve({data:matches.map(row=>({...row})),error:null}).then(resolve);}};return query;}};
}
test('consent is isolated by user, purpose and current version, and survives reload',async()=>{
 const db=database(),service=createPoseConsents();
 await assert.rejects(service.require(db,'a','recognition'),{status:403});
 await service.set(db,'a',{scope:'recognition',version,accepted:true});
 await createPoseConsents().require(db,'a','recognition');
 await assert.rejects(service.require(db,'b','recognition'),{status:403});
 await assert.rejects(service.require(db,'a','observation'),{status:403});
 db.rows[0].version='old';await assert.rejects(service.require(db,'a','recognition'),{status:403});
});
test('revocation stops use; explicitly accepting again restores only that scope',async()=>{
 const db=database(),service=createPoseConsents();
 for(const scope of ['recognition','observation'])await service.set(db,'a',{scope,version,accepted:true});
 await service.set(db,'a',{scope:'recognition',version,accepted:false});
 await assert.rejects(service.require(db,'a','recognition'),{status:403});
 await service.require(db,'a','observation');
 await service.set(db,'a',{scope:'recognition',version,accepted:true});await service.require(db,'a','recognition');
 assert.equal(db.rows.length,2);
});
test('invalid grants and unavailable database fail closed',async()=>{
 const db=database(),service=createPoseConsents();
 for(const body of [{scope:'video',version,accepted:true},{scope:'recognition',version:'old',accepted:true},{scope:'recognition',version,accepted:'yes'}])await assert.rejects(service.set(db,'a',body),{status:400});
 assert.equal(db.rows.length,0);
 const broken={from:()=>({select(){return this;},eq:async()=>({error:{code:'42P01',message:'private database details'}})})};
 await assert.rejects(service.require(broken,'a','recognition'),e=>e.status===503&&!e.message.includes('private'));
});
