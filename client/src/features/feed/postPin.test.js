import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPosts,canPinPost,setPostPinned} from './posts.js';
const post={id:9,author_id:'leader',crew_id:15,crews:{owner_id:'leader'},updated_at:'stamp',is_pinned:false};
test('pin requires own authorship AND crew ownership, with fresh RPC and version constraints',async()=>{
  assert.equal(canPinPost(post,'leader'),true);
  for(const changed of [{...post,author_id:'member'},{...post,crew_id:null},{...post,crews:{owner_id:'other'}}])await assert.rejects(setPostPinned({},'leader',changed,true));
  const calls=[];const db={async rpc(name,args){assert.equal(name,'is_crew_owner');assert.equal(args.p_crew_id,15);return {data:true};},from(){return {
    update(row){calls.push(row);return this;},eq(...args){calls.push(args);return this;},select(){return this;},async maybeSingle(){return {data:{id:9}};},
  };}};
  await setPostPinned(db,'leader',post,true);assert.deepEqual(calls[0],{is_pinned:true});
  for(const pair of [['author_id','leader'],['crew_id',15],['updated_at','stamp'],['is_pinned',false]])assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(pair)));
  db.rpc=async()=>({data:false});await assert.rejects(setPostPinned(db,'leader',post,true));
});
test('crew composite cursor traverses over 20 pinned rows then ordinary posts without loss, public remains chronological',async()=>{
  const rows=Array.from({length:53},(_,i)=>({id:i+1,is_pinned:i<27,crew_id:'15',visibility:'public',kind:'free'}));
  const db={from(){const filters=[],orders=[];let size=20;return {
    select(){return this;},eq(key,value){filters.push(row=>row[key]===value);return this;},lt(key,value){filters.push(row=>row[key]<Number(value));return this;},
    order(key){orders.push(key);return this;},limit(value){size=value;return this;},
    or(value){const id=Number(value.match(/id.lt.(\d+)/)[1]);filters.push(row=>!row.is_pinned||row.id<id);return this;},
    then(resolve){return Promise.resolve({data:rows.filter(row=>filters.every(fn=>fn(row))).sort((a,b)=>{for(const key of orders){const diff=Number(b[key])-Number(a[key]);if(diff)return diff;}return 0;}).slice(0,size)}).then(resolve);},
  };}};
  for(const crew of ['15',null]){
    let cursor=null;const found=[];
    for(let i=0;i<10;i++){const page=await loadPosts(db,crew,'',cursor);found.push(...page.rows);if(!page.next)break;cursor=page.next;}
    assert.equal(found.length,53);assert.equal(new Set(found.map(row=>row.id)).size,53);
    assert.equal(found[0].id,crew?27:53);
    if(crew){assert.ok(found.slice(0,27).every(row=>row.is_pinned));assert.ok(found.slice(27).every(row=>!row.is_pinned));}
  }
  await assert.rejects(loadPosts({},'15','',{id:'1),id.gt.0',is_pinned:true}));
});
test('stale pin mutation never reports success',async()=>{
  const db={async rpc(){return {data:true};},from(){return {update(){return this;},eq(){return this;},select(){return this;},async maybeSingle(){return {data:null};}};}};
  await assert.rejects(setPostPinned(db,'leader',post,true),/다시 조회/);
});
