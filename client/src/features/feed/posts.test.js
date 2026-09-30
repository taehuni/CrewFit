import test from 'node:test';
import assert from 'node:assert/strict';
import {postInput,loadPosts,loadPost,savePost,deletePost,feedContext} from './posts.js';
const form={kind:'free',visibility:'public',sport:'',content:' hello '};
function mock(result={data:[{id:1}]}){
  const calls=[];const db={from(table){calls.push(['from',table]);return {
    select(...args){calls.push(['select',...args]);return this;},eq(...args){calls.push(['eq',...args]);return this;},
    in(...args){calls.push(['in',...args]);return this;},lt(...args){calls.push(['lt',...args]);return this;},order(){return this;},limit(){return this;},
    insert(row){calls.push(['insert',row]);return this;},update(row){calls.push(['update',row]);return this;},delete(){calls.push(['delete']);return this;},
    async maybeSingle(){return result;},then(resolve){return Promise.resolve(result).then(resolve);},
  };}};return {db,calls};
}
test('post input trims content, validates limit, kind, sport and crew-only scope; ignores elevated fields',()=>{
  assert.deepEqual(postInput({...form,author_id:'victim',is_pinned:true},null),{content:'hello',kind:'free',visibility:'public',sport:null});
  for(const extra of [{content:' '},{content:'x'.repeat(5001)},{kind:'invalid'},{visibility:'crew'},{visibility:'private'},{sport:'bad'}])assert.throws(()=>postInput({...form,...extra},null));
  assert.equal(postInput({...form,visibility:'crew'},'15').visibility,'crew');
});
test('public list explicitly filters visibility, crew list scopes crew and cursor; invalid filters do not query',async()=>{
  const publicList=mock();await loadPosts(publicList.db,null);
  assert.ok(publicList.calls.some(c=>JSON.stringify(c)==='["eq","visibility","public"]'));
  const crewList=mock();await loadPosts(crewList.db,'15','recruit',{id:'23',is_pinned:false});
  for(const expected of [['eq','crew_id','15'],['eq','kind','recruit'],['lt','id','23']])assert.ok(crewList.calls.some(c=>JSON.stringify(c)===JSON.stringify(expected)));
  await assert.rejects(loadPosts({},'invalid'));await assert.rejects(loadPosts({},null,'bad'));
  assert.equal(await loadPost({},'invalid'),null);
  await assert.rejects(loadPosts(mock({error:{}}).db,null));
});
test('create supplies authenticated author and omits attachment/pinning fields; denied crew permission prevents write',async()=>{
  const {db,calls}=mock({data:{id:1}});await savePost(db,'me',{...form,author_id:'other',is_pinned:true});
  assert.deepEqual(calls.find(c=>c[0]==='insert')[1],{content:'hello',kind:'free',visibility:'public',sport:null,author_id:'me',crew_id:null});
  const denied=mock({data:{id:15}});denied.db.rpc=async()=>({data:false});
  await assert.rejects(savePost(denied.db,'me',form,'15'),/권한/);
  assert.ok(!denied.calls.some(c=>c[0]==='insert'));
  await assert.rejects(savePost({},null,form));
});
test('edit only author, immutable crew, optimistic timestamp, minimal payload and zero-row conflicts',async()=>{
  const existing={id:1,author_id:'me',crew_id:null,kind:'free',updated_at:'stamp'};
  const {db,calls}=mock({data:{id:1}});await savePost(db,'me',form,null,existing);
  for(const expected of [['eq','id',1],['eq','author_id','me'],['eq','updated_at','stamp']])assert.ok(calls.some(c=>JSON.stringify(c)===JSON.stringify(expected)));
  assert.equal(Object.hasOwn(calls.find(c=>c[0]==='update')[1],'crew_id'),false);
  await assert.rejects(savePost({},'other',form,null,existing));
  await assert.rejects(savePost({},'me',form,'15',existing));
  await assert.rejects(savePost(mock({data:null}).db,'me',form,null,existing),/다시 조회/);
});
test('delete only author or crew owner, scopes mutation and rejects zero rows',async()=>{
  const post={id:1,author_id:'writer',crew_id:15,crews:{owner_id:'leader'},updated_at:'stamp'};
  await assert.rejects(deletePost({},'stranger',post));
  for(const user of ['writer','leader']){
    const {db,calls}=mock();await deletePost(db,user,post);
    const expected=user==='writer'?['eq','author_id','writer']:['eq','crew_id',15];
    assert.ok(calls.some(c=>JSON.stringify(c)===JSON.stringify(expected)));
  }
  await assert.rejects(deletePost(mock({data:[]}).db,'leader',post));
});
test('feed context allows general writing but uses authoritative permission RPC for crew',async()=>{
  assert.deepEqual(await feedContext({},null),{crew:null,canWrite:true});
  await assert.rejects(feedContext({},'bad'));
  const {db}=mock({data:{id:15}});db.rpc=async(name,args)=>{assert.equal(name,'can_post_in_crew');assert.equal(args.p_crew_id,'15');return {data:true};};
  assert.equal((await feedContext(db,'15')).canWrite,true);
});
test('photo edit persists only own path, removal writes null and ordinary editing preserves attachment',async()=>{
  const existing={id:1,author_id:'me',crew_id:null,kind:'free',updated_at:'stamp'};
  for(const path of ['me/00000000-0000-4000-8000-000000000001.png',null,undefined]){
    const {db,calls}=mock({data:{id:1}});await savePost(db,'me',form,null,existing,path);
    const input=calls.find(c=>c[0]==='update')[1];
    assert.equal(input.image_path,path);assert.equal(Object.hasOwn(input,'image_path'),path!==undefined);
  }
  await assert.rejects(savePost({},'me',form,null,existing,'other/00000000-0000-4000-8000-000000000001.png'));
});
