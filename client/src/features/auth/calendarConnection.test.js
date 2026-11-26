import test from 'node:test';
import assert from 'node:assert/strict';
import {validCalendarRequest,verifyCalendarConnection,calendarRedirect,calendarRequestFromUrl,calendarReturnRequest,calendarAccountAccess} from './calendarConnection.js';
test('calendar eligibility requires an attached Google identity, not an email or provider label',()=>{
 for(const user of [null,{email:'same@gmail.com',app_metadata:{provider:'google'}},{identities:[{provider:'email'}]}]){
  const access=calendarAccountAccess(user);assert.equal(access.eligible,false);assert.match(access.reason,/웹과 앱 모두/);assert.match(access.reason,/저장한 운동 계획/);
 }
 assert.deepEqual(calendarAccountAccess({identities:[{provider:'email'},{provider:'google'}]}),{eligible:true,reason:''});
});
test('calendar return requires same owner, finite recent timestamp and no future request',()=>{
 assert.equal(validCalendarRequest({userId:'u',at:100},'u',101),true);
 for(const value of [null,{userId:'other',at:100},{userId:'u'},{userId:'u',at:NaN},{userId:'u',at:102},{userId:'u',at:0}])assert.equal(validCalendarRequest(value,'u',value?.at===0?900001:101),false);
});
test('iOS Safari return can recover non-secret context without PWA storage',()=>{
 const href=calendarRedirect('https://crewfit.example','owner',100),returned=calendarRequestFromUrl(href);
 assert.equal(new URL(href).pathname,'/auth/google');assert.deepEqual(returned,{userId:'owner',at:100});
 assert.deepEqual(calendarReturnRequest(null,returned,'owner',101),returned);
 assert.equal(calendarReturnRequest(null,null,'owner',101),null);
 assert.equal(calendarReturnRequest(null,returned,'other',101),null);
 assert.equal(calendarReturnRequest(null,returned,'owner',900101),null);
 const malformed=calendarRequestFromUrl('https://crewfit.example/auth/google?calendar=1&calendar_user=owner');
 assert.equal(calendarReturnRequest({userId:'owner',at:100},malformed,'owner',101),null);
 assert.deepEqual(calendarReturnRequest({userId:'owner',at:100},null,'owner',101),{userId:'owner',at:100});
 assert.doesNotMatch(href,/access_token|provider_token|refresh_token/);
});
test('presence of a google token is not a verified calendar connection',async()=>{
 let calls=0;
 const api=async(path,options)=>{calls++;assert.equal(path,'/calendar/connection');assert.equal(options.token,'crewfit-token');assert.equal(options.body.providerToken,'google-token');throw Object.assign(Error('permission required'),{status:403});};
 assert.equal((await verifyCalendarConnection(api,{access_token:'crewfit-token'})).connected,false);assert.equal(calls,0);
 await assert.rejects(()=>verifyCalendarConnection(api,{access_token:'crewfit-token',provider_token:'google-token'}),{status:403});assert.equal(calls,1);
 assert.deepEqual(await verifyCalendarConnection(async()=>({connected:true}),{access_token:'crewfit-token',provider_token:'google-token'}),{connected:true});
});
