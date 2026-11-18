import {useMemo,useState} from 'react';
import {Link} from 'react-router';
import {GYM_EXERCISE_CRITERIA} from './gymCriteria.js';
import './exercise-criteria.css';

const regions=['전체','가슴','등','어깨','팔','하체','코어','전신'];
export default function ExerciseCriteriaPanel(){
 const [search,setSearch]=useState(''),[region,setRegion]=useState('전체'),[selected,setSelected]=useState(null),[limit,setLimit]=useState(12);
 const rows=useMemo(()=>GYM_EXERCISE_CRITERIA.filter(row=>(region==='전체'||row.bodyRegion===region)&&[row.label,...row.aliases,...row.equipment].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[search,region]);
 function select(row){setSelected(row);requestAnimationFrame(()=>document.getElementById('criteria-detail-title')?.focus());}
 function list(){setSelected(null);requestAnimationFrame(()=>document.getElementById('criteria-search')?.focus());}
 return <div className="exercise-criteria-page">
  <Link className="pose-back" to="/pose">← 자세 측정으로</Link>
  <header className="page-head"><div><h1>운동별 자세 기준</h1><p>동작을 익히고, 확인할 포인트를 찾아보세요.</p></div></header>
  <p className="criteria-scope">이 목록은 운동 지침을 찾아보는 곳이에요. 모든 운동을 카메라로 평가하는 것은 아니에요. 실시간 자세 피드백은 현재 맨몸 스쿼트·제자리 런지·바닥 푸시업을 지원해요.</p>
  {selected?<section className="criteria-detail" aria-labelledby="criteria-detail-title">
   <button type="button" className="btn btn-ghost" onClick={list}>← 운동 목록으로</button>
   <div className="criteria-detail-heading"><span>{selected.bodyRegion} · {selected.equipment.join(' · ')}</span><h2 id="criteria-detail-title" tabIndex={-1}>{selected.label}</h2><p>{selected.evaluationStatus==='pending'?'근거 확인 중':'참고 지침'}</p></div>
   {selected.criteria.length?<section><h3>동작에서 확인할 점</h3><ul>{selected.criteria.map(text=><li key={text}>{text}</li>)}</ul></section>:<p className="criteria-pending">확인된 근거를 정리하고 있어요. 아직 이 동작의 자세 기준이나 평가 결과를 제공하지 않아요.</p>}
   {!!selected.observable.length&&<section><h3>영상에서 살펴볼 수 있는 항목</h3><p className="criteria-note">카메라 위치와 가림에 따라 확인이 어려울 수 있어요.</p><ul>{selected.observable.map(text=><li key={text}>{text}</li>)}</ul><p className="criteria-view">참고 촬영 방향 · {selected.preferredView}</p></section>}
   {!!selected.notObservable.length&&<section><h3>카메라만으로 확인하기 어려운 항목</h3><ul>{selected.notObservable.map(text=><li key={text}>{text}</li>)}</ul></section>}
   {!!selected.sources.length&&<section className="criteria-sources"><h3>참고한 자료</h3>{selected.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<span>새 창 ↗</span></a>)}<p>일반 운동 지침이며 개인별 적정 중량이나 부상 위험을 판정하는 기준은 아니에요.</p></section>}
  </section>:<>
   <label className="criteria-search" htmlFor="criteria-search">운동·기구 검색<input id="criteria-search" type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(12);}} placeholder="예: 벤치프레스, 케이블, 덤벨"/></label>
   <div className="criteria-filters" role="group" aria-label="운동 부위">{regions.map(item=><button type="button" key={item} aria-pressed={region===item} onClick={()=>{setRegion(item);setLimit(12);}}>{item}</button>)}</div>
   <p className="criteria-count" role="status">{rows.length}개 운동</p>
   <div className="criteria-grid">{rows.slice(0,limit).map(row=><button type="button" className="criteria-card" key={row.id} onClick={()=>select(row)}><span className="criteria-region">{row.bodyRegion}</span><strong>{row.label}</strong><span>{row.equipment.join(' · ')}</span><small>{row.evaluationStatus==='pending'?'근거 확인 중':'참고 지침 보기'} <span aria-hidden="true">↗</span></small></button>)}</div>
   {!rows.length&&<div className="criteria-empty"><p>일치하는 운동을 찾지 못했어요. 다른 운동명이나 기구로 검색해 보세요.</p><button className="btn btn-ghost" type="button" onClick={()=>{setSearch('');setRegion('전체');setLimit(12);}}>전체 운동 보기</button></div>}
   {rows.length>limit&&<button className="btn btn-ghost criteria-more" type="button" onClick={()=>setLimit(n=>n+12)}>운동 더 보기</button>}
  </>}
 </div>;
}
