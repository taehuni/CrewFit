import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatDrafts} from './chatDrafts.js';

test('switching direct and crew rooms keeps separate drafts, with no cross-account state',()=>{
 const first=createChatDrafts(),second=createChatDrafts();
 first.write('direct:1','hello');first.write('crew:1','crew text');first.write('direct:2','another');
 assert.equal(first.read('direct:1').text,'hello');assert.equal(first.read('crew:1').text,'crew text');
 assert.equal(second.read('direct:1').text,'');first.clear();assert.equal(first.read('crew:1').text,'');
});
test('failed submission can retry its id after switching rooms; only success clears it',()=>{
 const store=createChatDrafts();store.write('direct:1','hello');store.submitting('direct:1',{id:'a',body:'hello'});
 assert.equal(store.read('direct:1').pending.id,'a');store.sent('direct:1','other');assert.equal(store.read('direct:1').text,'hello');
 store.sent('direct:1','a');assert.equal(store.read('direct:1').text,'');
});
test('a late successful send cannot erase a new draft created in the same room',()=>{
 const store=createChatDrafts();store.write('crew:1','first');store.submitting('crew:1',{id:'a',body:'first'});
 store.write('crew:1','next message');store.sent('crew:1','a');assert.equal(store.read('crew:1').text,'next message');
 store.clearRoom('crew:1');assert.equal(store.read('crew:1').text,'');
});
