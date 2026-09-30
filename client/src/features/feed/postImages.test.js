import test from 'node:test';
import assert from 'node:assert/strict';
import {IMAGE_LIMIT,validatePostImage,validateImagePath,uploadPostImage,signPostImages} from './postImages.js';
test('photos accept only nonempty JPG/PNG/WebP up to 5MB, rejecting SVG and oversized files',()=>{
  for(const type of ['image/jpeg','image/png','image/webp'])validatePostImage({type,size:IMAGE_LIMIT});
  for(const file of [{type:'image/svg+xml',size:1},{type:'image/png',size:0},{type:'image/jpeg',size:IMAGE_LIMIT+1}])assert.throws(()=>validatePostImage(file));
});
test('attachment paths are own-folder only and null permits removal',()=>{
  validateImagePath('me/00000000-0000-4000-8000-000000000001.png','me');validateImagePath(null,'me');
  for(const path of ['other/00000000-0000-4000-8000-000000000001.png','me/../x.jpg','https://example.com/a.jpg','me/x.svg'])assert.throws(()=>validateImagePath(path,'me'));
});
test('upload uses private bucket, random own path and never overwrites; errors reject',async()=>{
  const file={type:'image/png',size:10};let call;
  const db={storage:{from(bucket){assert.equal(bucket,'post-images');return {async upload(...args){call=args;return {};}};}}};
  const path=await uploadPostImage(db,'me',file);
  validateImagePath(path,'me');assert.equal(call[0],path);assert.equal(call[1],file);assert.equal(call[2].upsert,false);
  await assert.rejects(uploadPostImage({storage:{from(){return {async upload(){return {error:{}};}};}}},'me',file));
});
test('signed URLs are batched/deduplicated and denied images never gain fallback public URL',async()=>{
  let called=false;
  const db={storage:{from(bucket){assert.equal(bucket,'post-images');return {async createSignedUrls(paths,ttl){called=true;assert.deepEqual(paths,['a','b']);assert.equal(ttl,3600);return {data:[{path:'a',signedUrl:'signed-a'},{path:'b',error:'denied'}]};}};}}};
  assert.deepEqual(await signPostImages(db,[]),{});assert.equal(called,false);
  assert.deepEqual(await signPostImages(db,['a','a','b',null]),{a:'signed-a'});
});
