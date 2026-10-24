import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProduct,createStoreCatalog,createProductDetail} from './store.js';
import {createOwnerclan} from './ownerclan.js';
import {storeSelection} from './storeSelection.js';
import {matchesSearch} from './storeRelevance.js';
const food={key:'W123',name:'오트밀 500g',status:'available',adultOnly:false,price:4000,images:['http://cdn.ownerclan.com/food.jpg'],category:{fullName:'식품>가루/분말류>오트밀'},options:[{price:4000,quantity:1}],shippingFee:3000};
test('only available, correctly classified, pictured products with stock enter store',()=>{
 const normalized=normalizeProduct(food,'foods');assert.equal(normalized.images[0],'https://cdn.ownerclan.com/food.jpg');
 for(const change of [{status:'soldout'},{adultOnly:true},{price:0},{images:['javascript:bad']},{options:[{price:4000,quantity:0}]},{name:'오트밀 맨투맨'},{name:'애견 닭가슴살'},{category:{fullName:'패션의류>코트'}}])assert.equal(normalizeProduct({...food,...change},'foods'),null);
 assert.equal(normalizeProduct(food,'equipment'),null);
 assert.deepEqual(Object.keys(normalized).sort(),['id','name','price','images','category','shippingFee','shippingType','options'].sort());
});
test('fixed selection refreshes only approved IDs, caches and omits unavailable picks',async()=>{
 let time=1000,calls=0;const provider=async(query)=>{calls++;assert.ok(!query.includes('allItems'));assert.ok(query.includes(storeSelection.foods[1].id));return {p1:{...food,key:storeSelection.foods[1].id},p0:{...food,key:storeSelection.foods[0].id,status:'soldout'}};};
 const list=createStoreCatalog(provider,()=>time);
 const [a,b]=await Promise.all([list('foods'),list('foods')]);assert.equal(calls,1);assert.equal(a.products.length,1);assert.deepEqual(a,b);
 await list('foods');assert.equal(calls,1);time+=300001;await list('foods');assert.equal(calls,2);
 await assert.rejects(list('bad'),{status:400});await assert.rejects(list('foods','x'.repeat(81)),{status:400});
});
test('search excludes hidden-keyword hits, sauces, pet food, mat bags and dumbbell ornaments',()=>{
 const item=(name,path)=>({...food,name,category:{fullName:path}});
 assert.equal(matchesSearch(item('닭가슴살 소스','식품>소스>닭가슴살소스'),'닭가슴살'),false);
 assert.equal(matchesSearch(item('닭가슴살 드레싱','식품>닭고기>닭가슴살'),'닭가슴살'),false);
 assert.equal(matchesSearch(item('삼계탕','식품>국/탕'),'닭가슴살'),false);
 assert.equal(matchesSearch(item('냉동 닭가슴살 200g','식품>닭고기>닭가슴살'),'닭 가슴살'),true);
 assert.equal(matchesSearch(item('요가매트가방 매트 별매','스포츠/레저>요가매트'),'요가매트'),false);
 assert.equal(matchesSearch(item('요가매트 논슬립 양말','스포츠/레저>요가복>상의'),'요가매트'),false);
 assert.equal(matchesSearch(item('덤벨 장식','스포츠/레저>헬스>아령'),'덤벨'),false);
 assert.equal(matchesSearch(item('육각 덤벨 3kg','스포츠/레저>헬스>아령'),'덤벨'),true);
 assert.equal(matchesSearch(item('오트밀 코트','패션의류>코트'),'오트밀'),false);
});
test('search scans past unrelated results, removes duplicates and sends variables',async()=>{
 let calls=0;const list=createStoreCatalog(async(query,variables)=>{
 calls++;assert.equal(variables.search,'닭가슴살');assert.equal(variables.category,'50013800');
 const node=calls===1?{...food,name:'닭가슴살소스',category:{fullName:'식품>소스'}}:{...food,name:'냉동 닭가슴살',category:{fullName:'식품>닭고기>닭가슴살'}};
 return {allItems:{edges:[{node},{node}],pageInfo:{hasNextPage:calls===1,endCursor:'next'}}};
 });
 const data=await list('foods','닭가슴살');assert.equal(calls,2);assert.equal(data.products.length,1);assert.equal(data.curated,false);
});
test('provider authenticates once, uses authorization only upstream, and hides credentials on errors',async()=>{
 let auth=0;const secret='private-password';
 const provider=createOwnerclan({env:{OWNERCLAN_USERNAME:'seller',OWNERCLAN_PASSWORD:secret},now:()=>Date.now()+100000,fetcher:async(url,options)=>{
 if(url.includes('auth.ownerclan')){auth++;assert.equal(JSON.parse(options.body).password,secret);return new Response('private-token');}
 assert.equal(options.headers.Authorization,'Bearer private-token');return Response.json({data:{ok:true}});
 }});
 assert.deepEqual(await provider('{ok}'),{ok:true});assert.deepEqual(await provider('{ok}'),{ok:true});assert.equal(auth,1);
 const failing=createOwnerclan({env:{OWNERCLAN_USERNAME:'seller',OWNERCLAN_PASSWORD:secret},fetcher:async()=>{throw new Error(secret);}});
 await assert.rejects(failing('{ok}'),e=>e.status===502&&!e.message.includes(secret));
});
test('missing credentials produce a safe configuration error',async()=>{
 await assert.rejects(createOwnerclan({env:{}})('{ok}'),{status:503});
});
test('direct product URLs validate IDs, fetch live details and omit unavailable products',async()=>{
 let calls=0,time=1000;
 const detail=createProductDetail(async(query,variables)=>{calls++;assert.equal(variables.id,'W123');return {item:{...food,content:'<img src="https://example.com/info.jpg">',origin:'국내산'}};},()=>time);
 await assert.rejects(detail('bad"query'),{status:404});assert.equal(calls,0);
 const result=await detail('W123');assert.equal(result.id,'W123');assert.equal(result.origin,'국내산');assert.equal(result.group,'foods');
 await detail('W123');assert.equal(calls,1);time+=300001;await detail('W123');assert.equal(calls,2);
 await assert.rejects(createProductDetail(async()=>({item:null}))('W123'),{status:404});
 await assert.rejects(createProductDetail(async()=>({item:{...food,status:'soldout'}}))('W123'),{status:404});
});
