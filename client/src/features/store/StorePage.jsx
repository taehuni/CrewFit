import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import {PartnersPage} from '../partners/index.js';
import './store.css';
import './store-catalog-polish.css';
const money=n=>Number(n).toLocaleString('ko-KR')+'원';
const themes={foods:['닭가슴살','오트밀','견과','두부','잡곡밥'],equipment:['요가매트','덤벨','러닝','폼롤러','밴드']};
function ProductImage({product}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[product.images[0]]);
 return <div className="store-product-photo">{failed?<span>사진을 불러오지 못했어요</span>:<img src={product.images[0]} alt={product.name} loading="lazy" onError={()=>setFailed(true)}/>}</div>;
}
export default function StorePage(){
 const {token}=useAuth();const [params,setParams]=useSearchParams();
 const category=['equipment','facilities'].includes(params.get('category'))?params.get('category'):'foods';
 const q=params.get('q')||'',facilities=category==='facilities',fromMeal=params.get('source')==='meal';
 const [draft,setDraft]=useState(q),[limit,setLimit]=useState(12);
 useEffect(()=>{setDraft(q);setLimit(12);},[category,q]);
 const catalog=useQuery({queryKey:['store-products-v2',category,q],queryFn:()=>api('/store/products?'+new URLSearchParams({category,q}),{token}),enabled:!!token&&!facilities,staleTime:300000,retry:false});
 function search(value){setParams(previous=>{const next=new URLSearchParams(previous);value?next.set('q',value):next.delete('q');return next;});}
 const products=catalog.data?.products||[];
 return <div className="store-page"><header className="page-head"><div><span className="section-eyebrow">FOR YOUR EVERYDAY</span><h1>스토어</h1><p>잘 먹고, 즐겁게 움직이는 일상을 위한 선택.</p></div><Link to="/meals">내 식단 기록 ↗</Link></header>
 <nav className="store-tabs" aria-label="스토어 카테고리">{[['foods','식품'],['equipment','운동용품'],['facilities','운동시설']].map(([id,name])=><button key={id} aria-pressed={category===id} onClick={()=>setParams({category:id})}>{name}</button>)}</nav>
 {facilities?<PartnersPage embedded/>:<>
 {fromMeal&&<section className="store-meal-context"><div><h2>식단에서 골라 온 식품</h2><p>{q?`${q} 관련 상품을 살펴보세요.`:'한 끼에 필요한 식품을 찾아보세요.'}</p></div><Link to="/meals?view=plans">저장한 식단으로 돌아가기 ↗</Link></section>}
 <section className="store-foods store-catalog-polished"><div className="store-discovery"><div><h2>{category==='foods'?'한 끼에 필요한 식품 찾기':'내 운동에 맞는 용품 찾기'}</h2><p>{category==='foods'?'단백질부터 곡물과 견과까지, 나에게 맞게 골라 보세요.':'홈트레이닝부터 러닝까지, 꾸준한 움직임을 위한 준비.'}</p></div><form className="store-search-form" onSubmit={e=>{e.preventDefault();search(draft.trim());}}><label className="store-search"><span>{category==='foods'?'식품 검색':'운동용품 검색'}</span><input type="search" maxLength={80} placeholder="찾고 싶은 상품을 입력하세요" value={draft} onChange={e=>setDraft(e.target.value)}/></label><button className="btn btn-primary">검색</button></form></div>
 <p className="store-footnote">상품 정보와 가격을 둘러볼 수 있어요. CrewFit 내 주문·결제는 아직 지원하지 않아요.</p>
 <div className="store-filters" aria-label="상품 빠른 검색"><button aria-pressed={!q} onClick={()=>search('')}>추천 상품</button>{themes[category].map(name=><button key={name} aria-pressed={q===name} onClick={()=>search(name)}>{name}</button>)}</div>
 <div className="store-results-heading"><h2>{q?`‘${q}’ 검색 결과`:'추천 상품'}</h2><span className="store-live-badge">오너클랜 상품</span></div>
 {catalog.isPending?<div className="store-empty" role="status">상품 사진과 가격을 불러오고 있어요…</div>:catalog.isError?<div className="store-empty" role="alert"><h3>상품을 불러오지 못했어요.</h3><p>{catalog.error.message}</p><button className="btn btn-primary" onClick={()=>catalog.refetch()}>다시 시도</button></div>:<><p className="store-count" role="status">{products.length}개 상품{catalog.data?.updatedAt&&` · ${new Date(catalog.data.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 확인`}</p><div className="store-grid store-live-grid">{products.slice(0,limit).map(product=><article className="store-card store-live-card" key={product.id}><Link className="store-product-open" to={`/store/products/${product.id}?${params.toString()}`} aria-label={product.name+' 상세 보기'}><ProductImage product={product}/><div className="store-card-body"><span className="store-tag">{product.category.split('>').slice(-1)}</span><h3>{product.name}</h3><p className="store-product-price">{money(product.price)}</p><small>공급처 조회 가격 · 배송비 별도</small><span className="store-product-more">상품 살펴보기 ↗</span></div></Link></article>)}</div>{!products.length&&<div className="store-empty"><h3>조건에 맞는 상품이 없어요.</h3><p>다른 검색어나 추천 상품을 확인해 보세요.</p><button className="btn btn-ghost" onClick={()=>search('')}>추천 상품 보기</button></div>}{products.length>limit&&<button className="btn btn-ghost store-load-more" onClick={()=>setLimit(n=>n+12)}>상품 더 보기</button>}</>}
 <p className="store-footnote">오너클랜에서 제공하는 상품 정보예요. 표시 가격은 최종 결제 금액이 아니며, 옵션·수량·배송 조건에 따라 달라질 수 있어요.</p></section></>}

 </div>;
}
