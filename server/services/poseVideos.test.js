import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {request} from 'node:http';
import {createPoseRouter} from '../routes/pose.js';
import {createPoseVideos,validateVideo,VIDEO_URL_TTL_SECONDS,MAX_VIDEO_BYTES} from './poseVideos.js';
const id='11111111-1111-4111-8111-111111111111', user='22222222-2222-4222-8222-222222222222';
const start=Date.parse('2026-11-18T00:00:00Z');
const clip=Buffer.from('1a45dfa30000000000000000','hex');
function fixture() {
  const state={row:null,owner:user,time:start,sessionCreated:start,files:new Set(),failUpload:false,failRemove:false,signed:[],adminCalls:0};
  function query(table) {
    let op='select',value,filters=[];
    const q={select(){return q;},insert(v){op='insert';value=v;return q;},update(v){op='update';value=v;return q;},delete(){op='delete';return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},lte(k,v){filters.push(r=>r[k]<=v);return q;},order(){return q;},limit(){return q;},maybeSingle(){return run(true);},then(a,b){return run(false).then(a,b);}};
    async function run(single) {
      if(table==='pose_sessions') {const row={id,user_id:state.owner,created_at:new Date(state.sessionCreated).toISOString()};return {data:filters.every(f=>f(row))?row:null};}
      if(op==='insert') {if(state.row)return {error:{code:'23505'}};state.row={...value};return {data:null};}
      const found=state.row&&filters.every(f=>f(state.row));
      if(op==='update'&&found)state.row={...state.row,...value};
      const result=found?{...state.row}:null;
      if(op==='delete'&&found)state.row=null;
      return {data:single?result:(result?[result]:[])};
    }
    return q;
  }
  const admin={from:query,storage:{from:()=>({
    async upload(path){if(state.failUpload)return {error:{statusCode:'500'}};if(state.files.has(path))return {error:{statusCode:'409'}};state.files.add(path);return {};},
    async remove(paths){if(state.failRemove)return {error:{statusCode:'500'}};paths.forEach(p=>state.files.delete(p));return {};},
    async createSignedUrl(path,ttl){state.signed.push({path,ttl});return {data:{signedUrl:'https://private.invalid/signed'}};},
  })}};
  const service=createPoseVideos({getAdmin:async()=>{state.adminCalls++;return admin;}});
  return {state,admin,service,db:{from:query}};
}
test('video bounds, MIME and signature fail closed',()=>{
  assert.equal(validateVideo(clip,'video/webm;codecs=vp8','120').seconds,120);
  for(const args of [[clip,'text/plain',1],[clip,'video/mp4',1],[clip,'video/webm',121],[clip,'video/webm',0],[clip,'video/webm','NaN'],[Buffer.alloc(MAX_VIDEO_BYTES+1),'video/webm',1]])assert.throws(()=>validateVideo(...args),{status:400});
});
test('foreign owner never reaches privileged storage',async()=>{
  const f=fixture();f.state.owner=id;
  for(const call of [()=>f.service.put(f.db,user,id,clip,'video/webm',30),()=>f.service.get(f.db,user,id),()=>f.service.remove(f.db,user,id)])await assert.rejects(call,{status:404});
  assert.equal(f.state.adminCalls,0);
});
test('upload/get/idempotent retry then different upload conflict',async()=>{
  const f=fixture();const first=await f.service.put(f.db,user,id,clip,'video/webm',30);
  assert.equal(first.video.expiresAt,null);assert.equal('expires_at' in f.state.row,false);
  assert.deepEqual(await f.service.put(f.db,user,id,clip,'video/webm',30),first);
  await assert.rejects(()=>f.service.put(f.db,user,id,Buffer.concat([clip,Buffer.from([1])]),'video/webm',30),{status:409});
  assert.equal((await f.service.get(f.db,user,id)).video.url,'https://private.invalid/signed');
  f.state.sessionCreated=start-365*86400000;
  assert.ok((await f.service.get(f.db,user,id)).video);
  assert.equal(f.state.signed.at(-1).ttl,VIDEO_URL_TTL_SECONDS);
  assert.deepEqual(await f.service.put(f.db,user,id,clip,'video/webm',30),first);
});
test('failed upload preserves retry reservation; delete tombstone prevents resurrection',async()=>{
  const f=fixture();f.state.failUpload=true;
  await assert.rejects(()=>f.service.put(f.db,user,id,clip,'video/webm',30),{status:503});
  assert.deepEqual(await f.service.get(f.db,user,id),{video:null});
  f.state.failUpload=false;await f.service.put(f.db,user,id,clip,'video/webm',30);
  await f.service.remove(f.db,user,id);
  assert.equal(f.state.files.size,0);assert.equal(f.state.row.state,'deleted');
  await assert.rejects(()=>f.service.put(f.db,user,id,clip,'video/webm',30),{status:409});
});
test('explicit deletion failure stays discoverable and can be retried without automatic removal',async()=>{
  const f=fixture();f.state.sessionCreated=start-365*86400000;
  await f.service.put(f.db,user,id,clip,'video/webm',30);
  f.state.failRemove=true;
  await assert.rejects(()=>f.service.remove(f.db,user,id),{status:503});
  assert.deepEqual(await f.service.get(f.db,user,id),{video:null,deletionPending:true});
  assert.equal(f.state.files.size,1);
  f.state.failRemove=false;
  assert.deepEqual(await f.service.get(f.db,user,id),{video:null,deletionPending:true});
  assert.equal(f.state.files.size,1);
  await f.service.remove(f.db,user,id);
  assert.equal(f.state.files.size,0);assert.deepEqual(await f.service.get(f.db,user,id),{video:null});
});
test('video HTTP routes authenticate before parsing and keep summary on upload failure',async t=>{
  const f=fixture(),app=express();
  app.use('/api/pose',createPoseRouter((req,res,next)=>{
    if(req.headers.authorization!=='Bearer test')return res.status(401).end();
    req.user={id:user};req.db=f.db;next();
  },{videos:f.service}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const send=(method,payload=clip,authorized=true)=>new Promise((resolve,reject)=>{
    const req=request(`http://127.0.0.1:${server.address().port}/api/pose/sessions/${id}/video`,{method,headers:{'Content-Type':'video/webm','X-Video-Duration-Seconds':'1.25',...(authorized?{Authorization:'Bearer test'}:{})}},res=>{
      let text='';res.on('data',part=>text+=part);res.on('end',()=>resolve({status:res.statusCode,data:text?JSON.parse(text):null,cache:res.headers['cache-control']}));
    });req.on('error',reject);req.end(method==='PUT'?payload:undefined);
  });
  assert.equal((await send('PUT',Buffer.from('bad'),false)).status,401);
  assert.equal((await send('PUT',Buffer.from('bad'))).status,400);
  f.state.failUpload=true;assert.equal((await send('PUT')).status,503);assert.equal(f.state.owner,user);
  f.state.failUpload=false;assert.equal((await send('PUT')).status,200);
  const get=await send('GET');assert.equal(get.cache,'no-store');assert.equal(get.data.video.durationSeconds,1.25);
  assert.equal((await send('DELETE')).status,204);assert.equal((await send('GET')).data.video,null);
});
