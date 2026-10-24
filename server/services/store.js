import {ownerclanQuery} from './ownerclan.js';
import {storeSelection} from './storeSelection.js';
import {matchesSearch,searchCategory} from './storeRelevance.js';

export function normalizeProduct(item,category){
  const path=item.category?.fullName||'';
  if(item.status!=='available'||item.adultOnly||!path.startsWith(category==='foods'?'식품>':'스포츠/레저>'))return null;
  // Some supplier listings are miscategorised (e.g. nut crackers listed as nuts).
  if(category==='foods'&&/망치|집게|연육기|다지기|분쇄기|보관함|보관통|장난감|강아지|고양이|반려|애견|애묘|사료|식기|주방용품|맨투맨|오버핏|긴팔|코트|니트|의류|볼펜|필기구|샴푸|바디워시|비누|스푼|스쿱|그물망|포장망|계량|커터|사사미|개껌|굳은살|각질|캐츄미/.test(item.name))return null;
  if(category==='equipment'&&/열쇠고리|키링|장난감|가방 장식|포인트 소품/.test(item.name))return null;
  if(!/^[A-Z0-9]+$/i.test(item.key)||typeof item.name!=='string'||!Number.isFinite(item.price)||item.price<=0)return null;
  const images=(item.images||[]).flatMap(value=>{try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))return [];url.protocol='https:';return [url.href];}catch{return [];}});
  if(!images.length)return null;
  const options=(item.options||[]).filter(o=>o.quantity>0&&Number.isFinite(o.price)&&o.price>0).map(o=>({name:(o.optionAttributes||[]).map(a=>`${a.name}: ${a.value}`).join(' · ')||'기본 옵션',price:o.price}));
  if(!options.length)return null;
  return {id:item.key,name:item.name,price:item.price,images:images.slice(0,4),category:path,shippingFee:item.shippingFee,shippingType:item.shippingType,options:options.slice(0,30)};
}
const fields=`key name price status adultOnly images(size:large) category{fullName} shippingFee shippingType options{price quantity optionAttributes{name value}}`;
const query=`query StoreProducts($search:String,$category:String,$after:String){allItems(first:18,after:$after,search:$search,category:$category,status:available){pageInfo{hasNextPage endCursor} edges{node{${fields}}}}}`;
export function createStoreCatalog(provider=ownerclanQuery,now=Date.now){
  const cache=new Map(),pending=new Map();
  return async function list(category='foods',search=''){
    if(!Object.hasOwn(storeSelection,category)||typeof search!=='string'||search.length>80)throw Object.assign(new Error('상품 검색 조건을 확인해 주세요.'),{status:400});
    search=search.trim();const key=JSON.stringify([category,search]);
    if(cache.get(key)?.expires>now())return cache.get(key).value;
    if(pending.has(key))return pending.get(key);
    if(pending.size>=8)throw Object.assign(new Error('상품 검색이 많아요. 잠시 후 다시 시도해 주세요.'),{status:429});
    const work=(async()=>{
      const products=[],seen=new Set();
      function add(item,term){
        const product=item&&matchesSearch(item,term)&&normalizeProduct(item,category);
        if(product&&!seen.has(product.id)){seen.add(product.id);products.push(product);}
      }
      if(!search){
        const picks=storeSelection[category];
        const data=await provider(`query CrewFitSelection{${picks.map((p,i)=>`p${i}:item(key:${JSON.stringify(p.id)}){${fields}}`).join(' ')}}`);
        picks.forEach((pick,i)=>{if(data[`p${i}`]?.key===pick.id)add(data[`p${i}`],pick.term);});
      }else{
        let after=null;
        // Scan a bounded number of pages; irrelevant results never fill empty slots.
        for(let page=0;page<3;page++){
          const data=await provider(query,{search,category:searchCategory(category,search),after});
          for(const {node} of data.allItems.edges)add(node,search);
          const info=data.allItems.pageInfo;
          if(products.length>=18||!info?.hasNextPage||!info.endCursor||info.endCursor===after)break;
          after=info.endCursor;
        }
        products.sort((a,b)=>Number(b.name.startsWith(search))-Number(a.name.startsWith(search)));
      }
      const value={products,source:'ownerclan',updatedAt:new Date(now()).toISOString(),curated:!search};
      if(cache.size>=60)cache.delete(cache.keys().next().value);
      cache.set(key,{value,expires:now()+300000});return value;
    })().finally(()=>pending.delete(key));pending.set(key,work);return work;
  };
}
export const listStoreProducts=createStoreCatalog();

export function createProductDetail(provider=ownerclanQuery,now=Date.now){
  const cache=new Map(),pending=new Map();
  return async function detail(id){
    if(typeof id!=='string'||!/^W[A-Z0-9]{3,20}$/.test(id))throw Object.assign(new Error('상품을 찾을 수 없어요.'),{status:404});
    if(cache.get(id)?.expires>now())return cache.get(id).value;
    if(pending.has(id))return pending.get(id);
    if(pending.size>=8)throw Object.assign(new Error('잠시 후 다시 시도해 주세요.'),{status:429});
    const work=(async()=>{
      const data=await provider(`query StoreProduct($id:ID!){item(key:$id){${fields} content model production origin returnable noReturnReason}}`,{id});
      const item=data.item;
      const category=item?.category?.fullName?.startsWith('식품>')?'foods':'equipment';
      const product=item&&normalizeProduct(item,category);
      if(!product)throw Object.assign(new Error('판매가 종료되었거나 현재 표시할 수 없는 상품이에요.'),{status:404});
      const value={...product,group:category,content:typeof item.content==='string'?item.content.slice(0,500000):'',model:item.model,production:item.production,origin:item.origin,returnable:item.returnable,noReturnReason:item.noReturnReason,updatedAt:new Date(now()).toISOString()};
      if(cache.size>=100)cache.delete(cache.keys().next().value);
      cache.set(id,{value,expires:now()+300000});return value;
    })().finally(()=>pending.delete(id));pending.set(id,work);return work;
  };
}
export const getStoreProduct=createProductDetail();
