import {useEffect,useMemo,useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../shared/api.js';
import {useAuth} from '../auth/index.js';
import './store.css';
import './store-product.css';

const money=n=>Number(n).toLocaleString('ko-KR')+'원';
function Photo({src,alt,...props}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 return failed?<div className="product-image-missing">사진을 불러오지 못했어요.</div>:<img src={src} alt={alt} onError={()=>setFailed(true)} {...props}/>;
}
// Never mount supplier HTML: discard active elements and render only text/images.
function descriptionBlocks(html){
 const doc=new DOMParser().parseFromString(html||'','text/html');
 doc.querySelectorAll('script,style,iframe,object,embed,svg,math,template,form,link,meta,video,audio').forEach(el=>el.remove());
 const blocks=[];
 function visit(node){
  if(blocks.length>=200)return;
  if(node.nodeType===3){const text=node.textContent.replace(/\s+/g,' ').trim();if(text)blocks.push({text});return;}
  if(node.nodeName==='IMG'){
   try{const url=new URL(node.getAttribute('src'));if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return;url.protocol='https:';blocks.push({src:url.href});}catch{/* Ignore invalid image references. */}return;
  }
  node.childNodes.forEach(visit);
 }
 visit(doc.body);return blocks;
}
export default function StoreProductPage(){
 const {productId}=useParams(),{token}=useAuth(),[params]=useSearchParams();
 const back='/store'+(params.toString()?'?'+params.toString():'');
 const query=useQuery({queryKey:['store-product',productId],queryFn:()=>api('/store/products/'+encodeURIComponent(productId),{token}),enabled:!!token,retry:false,staleTime:300000});
 const [imageIndex,setImageIndex]=useState(0),[option,setOption]=useState(0);
 useEffect(()=>{setImageIndex(0);setOption(0);window.scrollTo(0,0);},[productId]);
 const product=query.data;
 const blocks=useMemo(()=>descriptionBlocks(product?.content),[product?.content]);
 const backLink=<Link className="product-back" to={back}>← 상품 목록으로</Link>;
 if(query.isPending)return <div className="product-page">{backLink}<div className="store-empty" role="status">상품 상세 정보를 불러오고 있어요…</div></div>;
 if(query.isError)return <div className="product-page">{backLink}<section className="store-empty" role="alert"><h1>{query.error.status===404?'지금 볼 수 없는 상품이에요':'상품을 불러오지 못했어요'}</h1><p>{query.error.message}</p>{query.error.status!==404&&<button className="btn btn-primary" onClick={()=>query.refetch()}>다시 시도</button>}</section></div>;
 const picked=product.options[option];
 return <div className="product-page">{backLink}
 <div className="product-overview"><section className="product-gallery" aria-label="상품 사진"><div className="product-main-photo"><Photo src={product.images[imageIndex]} alt={product.name}/></div>{product.images.length>1&&<div className="product-thumbnails">{product.images.map((src,i)=><button key={src} aria-label={`상품 사진 ${i+1}`} aria-pressed={i===imageIndex} onClick={()=>setImageIndex(i)}><Photo src={src} alt=""/></button>)}</div>}</section>
 <section className="product-summary"><span className="section-eyebrow">{product.group==='foods'?'DAILY FOOD':'MOVE ESSENTIALS'}</span><p className="product-category">{product.category.split('>').join(' / ')}</p><h1>{product.name}</h1><div className="product-price-block"><span>공급처 조회 가격</span><strong>{money(picked?.price??product.price)}</strong><p>옵션·수량·배송 조건에 따라 최종 금액이 달라질 수 있어요.</p></div>
 <dl className="product-facts"><div><dt>배송비</dt><dd>{Number.isFinite(product.shippingFee)?money(product.shippingFee):'공급처 확인 필요'}{product.shippingType==='onDelivery'?' · 착불':''}</dd></div><div><dt>원산지</dt><dd>{product.origin||'공급처 상세 설명 확인'}</dd></div><div><dt>제조사</dt><dd>{product.production||'공급처 상세 설명 확인'}</dd></div><div><dt>상품번호</dt><dd>{product.id}</dd></div></dl>
 <label className="product-option">상품 옵션<select value={option} onChange={e=>setOption(Number(e.target.value))}>{product.options.map((o,i)=><option key={i} value={i}>{o.name} · {money(o.price)}</option>)}</select></label><p className="product-service-note">현재 상품을 살펴보는 단계예요.<br/>CrewFit 내 주문·결제는 아직 지원하지 않아요.</p><a className="btn btn-ghost product-description-link" href="#product-description">상품 상세 설명 보기 ↓</a>
 </section></div>
 <section className="product-description" id="product-description"><div className="product-section-heading"><span className="section-eyebrow">PRODUCT DETAILS</span><h2>상품 상세 설명</h2><p>공급처에서 제공한 정보예요. 용량·구성·사용 방법을 확인해 주세요.</p></div>{blocks.length?<div className="product-supplier-content">{blocks.map((block,i)=>block.src?<Photo key={i} src={block.src} alt={`공급처 상품 설명 이미지 ${i+1}`} loading="lazy"/>:<p key={i}>{block.text}</p>)}</div>:<p className="product-description-empty">공급처에서 제공한 추가 설명이 없어요. 용량과 구성은 상품명·옵션을 확인해 주세요.</p>}</section>
 <section className="product-purchase-info"><h2>확인해 주세요</h2><p>표시 가격과 배송 조건은 조회 시점 기준이에요. 실제 구매 조건은 판매처에서 최종 확인해야 해요.</p>{product.group==='foods'&&<p>영양성분·알레르기·보관 방법은 상품 표시사항을 확인해 주세요. 제공되지 않은 성분 정보는 추정하지 않아요.</p>}<p>반품: {product.returnable?'공급처 반품 기준에 따라 가능':product.noReturnReason||'공급처 반품 조건 확인 필요'}</p><small>오너클랜 제공 · {new Date(product.updatedAt).toLocaleString('ko-KR')} 조회</small></section>
 </div>;
}
