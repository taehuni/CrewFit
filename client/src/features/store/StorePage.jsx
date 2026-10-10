import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router';
import {PartnersPage} from '../partners/index.js';
import './store.css';
const categories=['전체','단백질 식품','간편한 한 끼','간식'];
const foods=[
 {id:'chicken',name:'닭가슴살',category:'단백질 식품',caption:'한 끼에 곁들이기 편한',tag:'조리 방식 확인',shape:'pack',color:'peach',label:'CHICKEN',description:'소스 유무, 1팩의 양, 냉장·냉동 보관 조건을 비교해 보세요.'},
 {id:'tofu',name:'두부',category:'단백질 식품',caption:'다양하게 요리하는',tag:'식물성 식재료',shape:'box',color:'sage',label:'TOFU',description:'찌개용과 부침용 등 용도와 포장 단위, 원재료를 확인해 보세요.'},
 {id:'oats',name:'오트밀',category:'간편한 한 끼',caption:'내 방식대로 준비하는',tag:'아침 식사 아이디어',shape:'bag',color:'sand',label:'OATS',description:'압착 형태와 조리 시간, 첨가 재료를 확인하고 좋아하는 식재료와 구성해 보세요.'},
 {id:'rice',name:'잡곡밥',category:'간편한 한 끼',caption:'바쁜 날에도 간편하게',tag:'1회분 용량 확인',shape:'box',color:'lavender',label:'GRAINS',description:'곡물 구성과 1개 용량, 조리 방법을 비교해 보세요.'},
 {id:'yogurt',name:'플레인 요거트',category:'간식',caption:'취향에 맞춰 곁들이는',tag:'당류·원재료 확인',shape:'cup',color:'peach',label:'YOGURT',description:'무가당 여부와 영양정보, 우유 등 알레르기 유발 성분을 확인해 보세요.'},
 {id:'nuts',name:'견과류',category:'간식',caption:'작게 나눠 챙기는',tag:'소포장 비교',shape:'bag',color:'sage',label:'NUTS',description:'견과 구성과 1봉 용량, 소금·설탕 첨가 여부 및 알레르기 표시를 살펴보세요.'},
];
function FoodArt({food}){return <div className={'store-art '+food.color} aria-hidden="true"><span className="store-art-orbit"/><div className={'store-package '+food.shape}><small>DAILY FOOD</small><strong>{food.label}</strong><span className="store-package-mark">●</span><small>MAKE IT YOURS</small></div></div>}
export default function StorePage(){
 const [params,setParams]=useSearchParams();const facilities=params.get('category')==='facilities';
 const [filter,setFilter]=useState('전체'),[search,setSearch]=useState(params.get('q')||'');
 const queryText=params.get('q')||'';
 useEffect(()=>{setSearch(queryText);setFilter('전체');},[queryText]);
 const visible=foods.filter(f=>(filter==='전체'||f.category===filter)&&`${f.name} ${f.category}`.includes(search.trim()));
 return <div className="store-page"><header className="page-head"><div><span className="section-eyebrow">FOR YOUR EVERYDAY</span><h1>스토어</h1><p>먹는 것부터 움직이는 공간까지, 나의 일상에 맞게.</p></div><Link to="/meals">내 식단 기록 ↗</Link></header>
 <nav className="store-tabs" aria-label="스토어 카테고리">{[['foods','식품'],['facilities','운동시설']].map(([id,name])=><button key={id} aria-pressed={facilities===(id==='facilities')} onClick={()=>setParams(id==='facilities'?{category:id}:{})}>{name}<span>{id==='foods'?'DAILY FOOD':'MOVE SPACE'}</span></button>)}</nav>
 {facilities?<PartnersPage embedded/>:<>
 <section className="store-hero"><div><span className="section-eyebrow">EAT WELL. MOVE WELL.</span><h2>잘 먹는 일도,<br/>나를 위한 운동.</h2><p>거창한 준비 대신, 일상에 더할 식품을 만나보세요.</p><a href="#store-foods">식품 둘러보기 ↓</a></div><div className="store-hero-word" aria-hidden="true">GOOD<br/><span>FOOD.</span></div></section>
 <div className="store-context"><div><strong>영양 상담은 AI 코치에서</strong><p>채팅에서 식단과 영양을 상담하고, 이곳에서는 직접 식품을 둘러보세요.</p></div><Link to="/coach">AI 코치 열기 ↗</Link></div>
 <section id="store-foods" className="store-foods"><div className="store-catalog-head"><div><h2>일상에 더할 식품</h2><p>상품 종류 예시 · 판매처 검색으로 연결돼요.</p></div><label className="store-search"><span>식품 검색</span><input type="search" placeholder="어떤 식품을 찾으세요?" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 <div className="store-filters" aria-label="식품 종류">{categories.map(c=><button key={c} aria-pressed={filter===c} onClick={()=>setFilter(c)}>{c}</button>)}</div><p className="store-count" role="status">{visible.length}가지 식품</p>
 <div className="store-grid">{visible.map(food=><article className="store-card" key={food.id}><FoodArt food={food}/><div className="store-card-body"><span className="store-tag">{food.tag}</span><p className="store-caption">{food.caption}</p><h3>{food.name}</h3><p className="store-description">{food.description}</p><div className="store-sellers"><a href={'https://search.shopping.naver.com/search/all?query='+encodeURIComponent(food.name)} target="_blank" rel="noopener noreferrer" aria-label={food.name+' 네이버쇼핑 검색 (새 탭)'}>네이버쇼핑 ↗</a><a href={'https://www.coupang.com/np/search?q='+encodeURIComponent(food.name)} target="_blank" rel="noopener noreferrer" aria-label={food.name+' 쿠팡 검색 (새 탭)'}>쿠팡 ↗</a></div></div></article>)}</div>
 {!visible.length&&<div className="store-empty"><h3>찾는 식품이 아직 없어요.</h3><p>다른 검색어나 종류를 선택해 보세요.</p><button className="btn btn-ghost" onClick={()=>{setFilter('전체');setSearch('');}}>전체 식품 보기</button></div>}
 <p className="store-footnote">현재는 식품 종류를 둘러보는 화면이에요. 이미지는 종류를 표현한 일러스트이며 실제 판매 상품이 아닙니다. 가격·영양정보·배송과 구매는 이동한 판매처에서 확인해 주세요. CrewFit 내 식품 결제는 아직 지원하지 않아요.</p></section>
 </>}
 </div>;
}
