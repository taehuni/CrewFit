import {useEffect,useRef,useState} from 'react';

export const facilityPhotos={
 'mapo-demo':{src:'/demo/photos/gym-v1.webp',alt:'웨이트 운동 공간 예시'},
 'seoul-demo':{src:'/demo/photos/stretching-v1.webp',alt:'스트레칭 공간 예시'},
 'run-demo':{src:'/demo/photos/run-path-v1.webp',alt:'야외 러닝 코스 예시'},
};
const money=value=>value.toLocaleString('ko-KR')+'원';

export function calendarDraft(row){
 const day=row.visit_on.replaceAll('-','');
 const end=new Date(row.visit_on+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);
 return 'https://calendar.google.com/calendar/render?'+new URLSearchParams({action:'TEMPLATE',text:'[데모] '+row.facility_name+' · '+row.offer_name,dates:day+'/'+end.toISOString().slice(0,10).replaceAll('-',''),details:'CrewFit 데모 방문 희망일입니다. 실제 시설 예약이 아니며 방문 시간은 확정되지 않았습니다. CrewFit에서 취소해도 이 일정은 자동 삭제되지 않습니다.'});
}

export default function ReservationSheet({selected,visit,setVisit,today,max,busy,error,ready,onReserve,onClose}){
 const [step,setStep]=useState(0),heading=useRef(null);
 const {facility,offer}=selected,photo=facilityPhotos[facility.id];
 useEffect(()=>{heading.current?.focus();},[step]);
 return <section className="partner-sheet partner-booking" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
  <button className="partner-close" aria-label="예약 창 닫기" disabled={busy} onClick={onClose}>×</button>
  <span className="section-eyebrow">체험 예약 · 데모</span>
  <h2 id="reservation-title" ref={heading} tabIndex={-1}>{['공간과 이용권 살펴보기','언제 방문하고 싶으세요?','신청 내용을 확인해 주세요'][step]}</h2>
  <ol className="partner-steps">{['이용권','방문일','내용 확인'].map((name,i)=><li key={name} aria-current={i===step?'step':undefined}><span>{i<step?'✓':i+1}</span>{name}</li>)}</ol>
  {step===0&&<>{photo&&<figure className="partner-detail-photo"><img src={photo.src} alt={photo.alt}/><figcaption>공간 분위기 예시 · 실제 시설 사진 아님</figcaption></figure>}<p className="partner-location">{facility.area} · 가상 시설</p><h3>{facility.name}</h3><p>{facility.description}</p><ul className="partner-amenities">{facility.features.map(feature=><li key={feature}>{feature}</li>)}</ul><div className="partner-selected-offer"><div><strong>{offer.name}</strong><small>{offer.minutes}분 · 예시 이용권</small></div><b>{money(offer.amount)}</b></div><button className="btn btn-primary btn-block" onClick={()=>setStep(1)}>이 이용권으로 날짜 선택</button></>}
  {step===1&&<form onSubmit={e=>{e.preventDefault();setStep(2);}}><p>{facility.name}<br/>{offer.name} · {offer.minutes}분</p><label>방문 희망일<input type="date" required value={visit} min={today} max={max} onChange={e=>setVisit(e.target.value)}/></label><p>오늘부터 90일 이내로 선택할 수 있어요. 시간대 선택은 아직 지원하지 않으며, 방문일은 확정 예약이 아닌 희망일이에요.</p><button className="btn btn-primary btn-block">신청 내용 확인</button><button className="btn btn-ghost btn-block" type="button" onClick={()=>setStep(0)}>이용권 다시 보기</button></form>}
  {step===2&&<form onSubmit={onReserve}><dl className="partner-review"><div><dt>운동 공간</dt><dd>{facility.name}</dd></div><div><dt>이용권</dt><dd>{offer.name} · {offer.minutes}분</dd></div><div><dt>방문 희망일</dt><dd>{visit}</dd></div></dl><div className="partner-total"><span>예시 이용 금액</span><strong>{money(offer.amount)}</strong></div><p>실제 시설로 전달되지 않는 데모 요청이에요. 저장 후 내 예약에서 카드 정보 없이 결제 흐름을 체험할 수 있어요.</p>{error&&<p role="alert">{error}</p>}<button className="btn btn-primary btn-block" disabled={busy||!ready}>{busy?'저장 중…':'데모 예약 요청 저장'}</button><button className="btn btn-ghost btn-block" type="button" disabled={busy} onClick={()=>setStep(1)}>방문일 수정</button>{!ready&&<p role="status">예약 내역을 불러온 뒤 저장할 수 있어요.</p>}</form>}
 </section>;
}
