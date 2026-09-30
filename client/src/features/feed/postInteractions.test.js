import test from 'node:test';
import assert from 'node:assert/strict';
import {commentInput,interactionPage,likeSummary,setLike,saveComment,deleteComment} from './postInteractions.js';
function mock({post={id:1,crews:{owner_id:'leader'}},result={data:{id:3}},error=null}={}){
  const calls=[];
  return {calls,db:{from(table){return {
    select(...args){calls.push([table,'select',...args]);return this;},eq(...args){calls.push([table,...args]);return this;},gt(...args){calls.push([table,'gt',...args]);return this;},order(){return this;},limit(){return this;},
    insert(row){calls.push([table,'insert',row]);return this;},update(row){calls.push([table,'update',row]);return this;},delete(){calls.push([table,'delete']);return this;},
    async maybeSingle(){return table==='posts'?{data:post,error}:result;},then(resolve){return Promise.resolve(result).then(resolve);},
  };}}};
}
test('comment validation trims and rejects empty, oversized and non-text input',()=>{
  assert.equal(commentInput(' hi '),'hi');for(const value of ['', ' ', null, {}, 'a'.repeat(1001)])assert.throws(()=>commentInput(value));
});
test('comment writes use caller and optimistic version, never allow another author or post',async()=>{
  const {db,calls}=mock();await saveComment(db,'me',1,' hi ');
  assert.deepEqual(calls.find(c=>c[1]==='insert'),['comments','insert',{post_id:1,author_id:'me',content:'hi'}]);
  const existing={id:3,post_id:1,author_id:'me',updated_at:'stamp'};await saveComment(db,'me',1,'edit',existing);
  assert.ok(calls.some(c=>JSON.stringify(c)==='["comments","updated_at","stamp"]'));
  await assert.rejects(saveComment({},'other',1,'edit',existing));await assert.rejects(saveComment({},'me',2,'edit',existing));
  await assert.rejects(saveComment(mock({result:{data:null}}).db,'me',1,'edit',existing));
});
test('invisible post blocks every mutation before writes',async()=>{
  for(const action of [db=>setLike(db,'me',1,true),db=>saveComment(db,'me',1,'text'),db=>deleteComment(db,'me',1,{})]){
    const {db,calls}=mock({post:null});await assert.rejects(action(db));assert.ok(!calls.some(c=>['insert','delete','update'].includes(c[1])));
  }
});
test('delete allows comment author or authoritative crew owner; scopes post, id and timestamp',async()=>{
  const comment={id:3,post_id:1,author_id:'me',updated_at:'stamp'};
  for(const user of ['me','leader']){
    const {db,calls}=mock({result:{data:[{id:3}]}});await deleteComment(db,user,1,comment);
    for(const expected of [['comments','id',3],['comments','post_id',1],['comments','updated_at','stamp']])assert.ok(calls.some(c=>JSON.stringify(c)===JSON.stringify(expected)));
  }
  await assert.rejects(deleteComment(mock().db,'stranger',1,comment));
  await assert.rejects(deleteComment(mock({result:{data:[]}}).db,'me',1,comment));
});
test('likes are idempotent on duplicate, own-only on cancellation, and errors do not report success',async()=>{
  const duplicate=mock({result:{error:{code:'23505'}}});await setLike(duplicate.db,'me',1,true);
  const cancel=mock();await setLike(cancel.db,'me',1,false);
  assert.ok(cancel.calls.some(c=>JSON.stringify(c)==='["post_likes","user_id","me"]'));
  await assert.rejects(setLike(mock({result:{error:{code:'42501'}}}).db,'me',1,true));
});
test('summary and lists are post-scoped with cursor; failed count is not zero',async()=>{
  const {db,calls}=mock({result:{data:[],count:0}});await interactionPage(db,1,'comments',20);await interactionPage(db,1,'likes','uuid');
  assert.ok(calls.some(c=>JSON.stringify(c)==='["comments","gt","id",20]'));
  assert.ok(calls.some(c=>JSON.stringify(c)==='["post_likes","post_id",1]'));
  await assert.rejects(likeSummary(mock({result:{error:{}}}).db,'me',1));
  await assert.rejects(interactionPage({},1,'bad'));
});
