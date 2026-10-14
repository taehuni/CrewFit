import test from 'node:test';
import assert from 'node:assert/strict';
import {needsProfileCompletion} from './profileCompletion.js';
import {WEEK_DAYS,dayLabel} from '../crews/crews.js';
const google={identities:[{provider:'google'}]};
test('Google members must supply required identity fields; sport is optional',()=>{
 assert.equal(needsProfileCompletion(google,{profile:{nickname:'러너'},settings:{real_name:null}}),true);
 assert.equal(needsProfileCompletion(google,{profile:{nickname:' '},settings:{real_name:'회원'}}),true);
 assert.equal(needsProfileCompletion(google,{profile:{nickname:'러너'},settings:{real_name:'회원',interested_sports:[]}}),false);
 assert.equal(needsProfileCompletion({identities:[{provider:'email'}]},{}),false);
 assert.equal(needsProfileCompletion({app_metadata:{providers:['google']}},{}),true);
});
test('Monday first labels retain Sunday=0 stored values',()=>{
 assert.deepEqual(WEEK_DAYS.map(d=>d.value),[1,2,3,4,5,6,0]);
 assert.deepEqual(WEEK_DAYS.map(d=>d.label),['월','화','수','목','금','토','일']);
 assert.equal(dayLabel([0,3,1]),'월 · 수 · 일');
});
