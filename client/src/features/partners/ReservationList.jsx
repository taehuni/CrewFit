import {calendarDraft} from './ReservationSheet.jsx';
import {filterReservations,reservationGroup} from './reservationList.js';
const statuses={pending:'예약 요청 · 결제 전',test_paid:'결제 시뮬레이션 완료',cancelled:'취소 완료'};
const filters=[['upcoming','방문 예정'],['past','지난 내역'],['cancelled','취소'],['all','전체']];
export default function ReservationList({query,today,filter,onFilter,onAction}){
 const rows=query.data||[],visible=filterReservations(rows,filter,today);
 return <section id="partner-reservations" className="partner-reservations" tabIndex={-1}>
  <header><div><span className="section-eyebrow">MY VISITS</span><h2>내 예약</h2></div><span>최근 100개 · 데모 예약</span></header>
  <p className="partner-calendar-note">방문 희망일 기준으로 정리했어요. 실제 시설 예약이나 방문 완료를 뜻하지 않아요.</p>
  <nav className="reservation-filters" aria-label="예약 내역 구분">{filters.map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>onFilter(id)}>{label}<span>{query.isSuccess?(id==='all'?rows.length:rows.filter(row=>reservationGroup(row,today)===id).length):'—'}</span></button>)}</nav>
  {query.isPending?<p className="partner-empty" role="status">예약을 불러오는 중…</p>:query.isError?<div className="partner-empty" role="alert"><p>{query.error.message}</p><button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 시도</button></div>:!visible.length?<div className="partner-empty"><strong>{!rows.length?'첫 운동을 계획해 볼까요?':filter==='upcoming'?'예정된 방문이 없어요.':filter==='cancelled'?'취소한 예약이 없어요.':'이곳에 표시할 예약이 없어요.'}</strong><p>{!rows.length||filter==='upcoming'?'마음에 드는 공간과 체험권을 골라 보세요.':'다른 내역도 확인해 보세요.'}</p><button className="btn btn-ghost" onClick={()=>{if(rows.length&&filter!=='upcoming')onFilter('all');else document.getElementById('partner-facilities')?.scrollIntoView({block:'start',behavior:'smooth'});}}>{rows.length&&filter!=='upcoming'?'전체 내역 보기':'운동시설 둘러보기'}</button></div>:<div className="reservation-list">{visible.map(row=>{
   const past=row.visit_on<today,cancelled=row.status==='cancelled';
   return <article className="partner-reservation reservation-ticket" key={row.id}>
    <time className="reservation-date" dateTime={row.visit_on}><small>{Number(row.visit_on.slice(5,7))}월</small><strong>{Number(row.visit_on.slice(8,10))}</strong><span>{row.visit_on===today?'오늘':past?'지난 희망일':'방문 희망일'}</span></time>
    <div className="reservation-ticket-body"><span className={'reservation-status '+row.status}>{statuses[row.status]||row.status}</span><h3>{row.facility_name}</h3><p>{row.offer_name}</p><div className="reservation-meta"><span>{row.visit_on}</span><strong>{row.amount.toLocaleString('ko-KR')}원 <small>예시 금액</small></strong></div><small>예약 번호 {row.id.slice(0,8)}</small>
    <div className="reservation-actions">{!cancelled&&!past&&<a className="btn btn-ghost" href={calendarDraft(row)} target="_blank" rel="noopener noreferrer">캘린더에 일정 작성 ↗<span className="sr-only"> (새 탭)</span></a>}{row.status==='pending'&&!past&&<button className="btn btn-primary" onClick={()=>onAction(row,'simulate')}>결제 흐름 체험</button>}{!cancelled&&<button className="btn btn-ghost" onClick={()=>onAction(row,'cancel')}>예약 취소</button>}</div>
    {cancelled&&<p className="reservation-tip">캘린더에 작성한 일정이 있다면 직접 삭제해 주세요.</p>}{past&&!cancelled&&<p className="reservation-tip">희망일이 지난 내역이에요. 실제 이용 여부는 기록하지 않아요.</p>}</div>
   </article>;
  })}</div>}
  <p className="partner-calendar-note">캘린더에는 종일 데모 일정으로 작성해요. 예약 취소와 캘린더 일정 삭제는 별도로 처리됩니다.</p>
 </section>;
}
