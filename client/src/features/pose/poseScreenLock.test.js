import test from 'node:test';
import assert from 'node:assert/strict';
import {createPoseScreenLock} from './poseScreenLock.js';

test('requests screen once while active and releases once on repeated stop',async()=>{
 let requests=0,releases=0;
 const controller=createPoseScreenLock({request:async kind=>{assert.equal(kind,'screen');requests++;return {release:async()=>{releases++;}};}});
 await Promise.all([controller.start(),controller.start()]);
 assert.equal(requests,1);
 await Promise.all([controller.stop(),controller.stop()]);
 assert.equal(releases,1);
});

test('late acquisition after stop releases the pending lock',async()=>{
 let resolve,releases=0;
 const controller=createPoseScreenLock({request:()=>new Promise(r=>{resolve=r;})});
 const acquisition=controller.start();await Promise.resolve();await controller.stop();
 resolve({release:async()=>{releases++;}});await acquisition;
 assert.equal(releases,1);
});

test('old acquisition cannot replace the lock of a restarted camera',async()=>{
 const resolvers=[];let oldReleases=0,newReleases=0;
 const controller=createPoseScreenLock({request:()=>new Promise(r=>resolvers.push(r))});
 const old=controller.start();await Promise.resolve();await controller.stop();
 const current=controller.start();await Promise.resolve();
 resolvers[1]({release:async()=>{newReleases++;}});await current;
 resolvers[0]({release:async()=>{oldReleases++;}});await old;
 assert.equal(oldReleases,1);assert.equal(newReleases,0);
 await controller.stop();assert.equal(newReleases,1);
});

test('stop before request dispatch avoids acquiring a lock',async()=>{
 let requests=0;
 const controller=createPoseScreenLock({request:async()=>{requests++;}});
 const acquisition=controller.start();await controller.stop();await acquisition;
 assert.equal(requests,0);
});

test('missing API, synchronous failures and rejections are harmless without retries',async()=>{
 for(const api of [undefined,{}, {request(){throw Error('denied');}}, {request:async()=>{throw Error('denied');}}]){
  const controller=createPoseScreenLock(api);
  await controller.start();await controller.start();await controller.stop();
 }
 for(const release of [()=>{throw Error('release');},async()=>{throw Error('release');}]){
  const controller=createPoseScreenLock({request:async()=>({release})});
  await controller.start();await controller.stop();await controller.stop();
 }
});

test('browser-released locks are not reacquired or released again automatically',async()=>{
 let requests=0,releases=0;
 const lock={released:false,release:async()=>{releases++;}};
 const controller=createPoseScreenLock({request:async()=>{requests++;return lock;}});
 await controller.start();lock.released=true;await controller.start();await controller.stop();
 assert.equal(requests,1);assert.equal(releases,0);
});
