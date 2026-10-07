import test from 'node:test';
import assert from 'node:assert/strict';
import {optionalResult,saveResult,validatePhoto,loadMemberCard} from './community.js';
test('only missing community schema gets fallback; access/network failures surface',async()=>{
 assert.equal(await optionalResult(Promise.resolve({error:{code:'42P01'}})),null);
 await assert.rejects(optionalResult(Promise.resolve({error:{code:'42501'}})));
 await assert.rejects(saveResult(Promise.resolve({error:{code:'42P01'}})));
});
test('community photo inputs reject executable formats and oversize uploads',()=>{
 validatePhoto({type:'image/webp',size:1024});
 for(const f of [{type:'image/svg+xml',size:100},{type:'image/jpeg',size:0},{type:'image/png',size:21*1024*1024}])assert.throws(()=>validatePhoto(f));
});
test('missing card never signs another path or creates public media URL',async()=>{
 const q={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null})};
 assert.equal(await loadMemberCard({from:()=>q},'member'),null);
});
