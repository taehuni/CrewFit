import {useId,useRef,useState} from 'react';
import {Link} from 'react-router';
import BodyRegionIcon from './BodyRegionIcon.jsx';
import {POSE_BODY_REGIONS,filterPoseExercises,poseBodyRegion,poseExerciseSelection} from './poseCatalog.js';
import searchIcon from './vendor/heroicons/24/outline/magnifying-glass.svg?url';
import chevronIcon from './vendor/heroicons/24/outline/chevron-right.svg?url';
import closeIcon from './vendor/heroicons/24/outline/x-mark.svg?url';
import './pose-exercise-picker.css';

function Chevron(){return <img className="pose-catalog-chevron" src={chevronIcon} alt="" aria-hidden="true" width="24" height="24"/>;}

function ExerciseImage({item}){
 const [failed,setFailed]=useState(false);
 return <span className={`pose-catalog-thumbnail ${item.image&&!failed?'pose-catalog-thumbnail-photo':''}`}>
  {item.image&&!failed?<img src={item.image} alt="" width="160" height="128" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<BodyRegionIcon region={item.region}/>}
 </span>;
}

function ExerciseContent({item}){
 return <><ExerciseImage item={item}/><span className="pose-catalog-row-copy"><strong>{item.label}</strong><span className="pose-catalog-equipment">{item.equipment.join(' · ')}</span><span className={`pose-catalog-method pose-catalog-method-${item.mode}`}>{item.method}</span>{item.detail&&<span className="pose-catalog-detail">{item.detail}</span>}</span><Chevron/></>;
}

export default function PoseExercisePicker({search='',onSearch,region='all',onRegionChange,selected,other='',onSelect,onCustom,onOtherChange}){
 const id=useId(),customInput=useRef(null);
 const activeRegion=poseBodyRegion(region),items=filterPoseExercises({search,region:activeRegion.id}),hasSearch=Boolean(search.trim());
 const title=activeRegion.id==='all'?'전체 운동':`${activeRegion.label} 운동`;
 const custom=selected==='other';
 function selectExercise(item){const selection=poseExerciseSelection(item);onSelect(selection.id,selection.label);}
 function openCustom(){onCustom();requestAnimationFrame(()=>customInput.current?.focus());}
 return <section className="pose-catalog" aria-label="운동과 측정 방식 선택">
  <div className="pose-catalog-search">
   <label htmlFor={`${id}-search`} className="pose-catalog-sr-only">운동·기구 검색</label>
   <img className="pose-catalog-search-icon" src={searchIcon} alt="" aria-hidden="true" width="24" height="24"/>
   <input id={`${id}-search`} type="search" value={search} onChange={event=>onSearch(event.target.value)} placeholder="운동·기구 검색" aria-controls={`${id}-results`} autoComplete="off"/>
   {hasSearch&&<button type="button" className="pose-catalog-search-clear" onClick={()=>onSearch('')} aria-label="검색어 지우기"><img src={closeIcon} alt="" aria-hidden="true" width="24" height="24"/></button>}
  </div>
  <section className="pose-catalog-regions" aria-labelledby={`${id}-regions`}>
   <h2 id={`${id}-regions`}>운동 부위</h2>
   <div className="pose-catalog-region-grid" role="group" aria-label="운동 부위 필터">
    {POSE_BODY_REGIONS.map(item=><button key={item.id} type="button" className="pose-catalog-region" aria-pressed={activeRegion.id===item.id} aria-controls={`${id}-results`} onClick={()=>onRegionChange(item.id)}><BodyRegionIcon region={item.id}/><span>{item.label}</span></button>)}
   </div>
  </section>
  <section className="pose-catalog-results" id={`${id}-results`} aria-labelledby={`${id}-title`}>
   <div className="pose-catalog-results-heading"><h2 id={`${id}-title`}>{title}{hasSearch&&<span> 검색 결과</span>}</h2><span className="pose-catalog-count" role="status" aria-live="polite" aria-atomic="true"><span className="pose-catalog-sr-only">{title}{hasSearch?' 검색 결과':''} </span>{items.length}개</span></div>
   {hasSearch&&<p className="pose-catalog-filter-note">{activeRegion.id==='all'?'전체 부위':activeRegion.label}에서 “{search.trim()}” 검색 중<button type="button" onClick={()=>onSearch('')}>검색 지우기</button></p>}
   {items.length>0?<ul className="pose-catalog-list">{items.map(item=><li key={item.id}>{item.mode==='local'?<Link className="pose-catalog-row" to={item.href}><ExerciseContent item={item}/></Link>:<button type="button" className="pose-catalog-row" aria-pressed={selected===item.id||(custom&&other===item.label)} onClick={()=>selectExercise(item)}><ExerciseContent item={item}/></button>}</li>)}</ul>:<div className="pose-catalog-empty"><strong>조건에 맞는 운동이 없어요</strong><p>{activeRegion.id==='all'?'다른 운동이나 기구 이름으로 검색해 보세요.':`${activeRegion.label} 부위 안에서 찾고 있어요. 검색어를 바꾸거나 전체 부위를 확인해 보세요.`}</p><div>{hasSearch&&<button type="button" onClick={()=>onSearch('')}>검색어 지우기</button>}{activeRegion.id!=='all'&&<button type="button" onClick={()=>onRegionChange('all')}>전체 부위 보기</button>}</div></div>}
  </section>
  <section className="pose-catalog-custom" aria-labelledby={`${id}-custom-title`}>
   <div className="pose-catalog-custom-heading"><h2 id={`${id}-custom-title`}>찾는 운동이 없나요?</h2><button type="button" className="pose-catalog-custom-toggle" aria-expanded={custom} aria-controls={`${id}-custom-fields`} onClick={openCustom}>운동 이름 직접 입력<Chevron/></button></div>
   <p>자세 평가 없이 이름·시간만 기록해요. <Link to="/activities/new?sport=gym">카메라 없이 직접 기록</Link></p>
   {custom&&<div className="pose-catalog-custom-fields" id={`${id}-custom-fields`}><label htmlFor={`${id}-other`}>운동 이름</label><input id={`${id}-other`} ref={customInput} maxLength={60} value={other} onChange={event=>onOtherChange(event.target.value)} placeholder="예: 오늘 한 운동"/><button type="button" className="pose-catalog-custom-submit" disabled={!other.trim()} onClick={()=>onSelect('other',other.trim())}>시간 기록 준비</button></div>}
  </section>
 </section>;
}
