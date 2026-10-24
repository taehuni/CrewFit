import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import FeedbackContent from './FeedbackContent.jsx';
import {useAuth} from '../auth/index.js';
import {supabase} from '../../shared/supabaseClient.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {monthDays, moveMonth} from '../../shared/calendar.js';
import {FEEDBACK_PERIODS, feedbackPeriodLabel, loadFeedbackMonth, kstToday} from './feedback.js';

export default function FeedbackHistory() {
  const {user} = useAuth();
  const today = kstToday();
  const [month,setMonth] = useState(today.slice(0,7));
  const [chosenDate,setChosenDate] = useState(null);
  const [chosenId,setChosenId] = useState(null);
  const history = useQuery({queryKey:[...queryKeys.feedbackHistory(user.id),'month',month],
    queryFn:()=>loadFeedbackMonth(supabase,user.id,month),retry:false});
  const rows = history.data || [];
  const dayOf = row => kstToday(new Date(row.created_at));
  const counts = new Map();
  for (const row of rows) counts.set(dayOf(row),(counts.get(dayOf(row))||0)+1);
  const selectedDate = chosenDate || (rows.length ? dayOf(rows[0]) : `${month}-01`);
  const dayRows = rows.filter(row=>dayOf(row)===selectedDate);
  const selected = dayRows.find(row=>String(row.id)===chosenId) || dayRows[0];
  function changeMonth(value){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return;setMonth(value);setChosenDate(null);setChosenId(null);}
  function chooseDay(value){setChosenDate(value);setChosenId(null);}
  return <section className="feedback-history" aria-labelledby="feedback-history-title">
    <h2 id="feedback-history-title">지난 코칭</h2>
    <p>코칭을 받은 날을 골라 다시 읽어보세요. 분석한 기간은 각 코칭에 따로 표시돼요.</p>
    <div className="feedback-history-layout">
      <section className="feedback-calendar" aria-label="코칭 받은 날짜 달력" aria-busy={history.isFetching}>
        <div className="feedback-calendar-head">
          <button type="button" aria-label="이전 달" onClick={()=>changeMonth(moveMonth(month,-1))}>‹</button>
          <label><span className="sr-only">코칭 이력 조회 월</span><input aria-label="코칭 이력 조회 월" type="month" value={month} onChange={e=>changeMonth(e.target.value)}/></label>
          <button type="button" aria-label="다음 달" onClick={()=>changeMonth(moveMonth(month,1))}>›</button>
        </div>
        <div className="feedback-calendar-week" aria-hidden="true">{['월','화','수','목','금','토','일'].map(day=><span key={day}>{day}</span>)}</div>
        <div className="feedback-calendar-days">{monthDays(month).map((day,index)=>day?<button type="button" key={day} aria-label={`${day}${history.isPending||history.isError?'':`, 받은 코칭 ${counts.get(day)||0}개`}`} aria-pressed={selectedDate===day} aria-current={day===today?'date':undefined} onClick={()=>chooseDay(day)}><span>{Number(day.slice(8))}</span><i aria-hidden="true" className={counts.has(day)?'has-feedback':''}/></button>:<span key={`empty-${index}`}/>)}</div>
        <footer><span>● 코칭 받은 날</span><button type="button" onClick={()=>{changeMonth(today.slice(0,7));chooseDay(today);}}>오늘</button></footer>
        {history.isPending?<p role="status">이달의 코칭을 불러오고 있어요.</p>:history.isError?<div role="alert"><p>코칭 이력을 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={()=>history.refetch()}>다시 조회</button></div>:<p className="feedback-calendar-count">이달에 받은 코칭 <strong>{rows.length}개</strong></p>}
      </section>
      <div className="feedback-history-reading">
        <header className="feedback-history-day"><h3>{Number(selectedDate.slice(5,7))}월 {Number(selectedDate.slice(8))}일 받은 코칭</h3>{history.isSuccess&&<span>{dayRows.length}개</span>}</header>
        {history.isSuccess&&!dayRows.length&&<div className="feedback-history-empty"><strong>{rows.length?'이날 받은 코칭은 없어요.':'이달에 받은 코칭은 없어요.'}</strong><p>{rows.length?'달력에서 점이 있는 날짜를 선택해 주세요.':'이전 달을 확인하거나 기간별 코칭에서 새 코칭을 받아보세요.'}</p></div>}
        {!!dayRows.length&&<div className="feedback-session-list" role="group" aria-label="이날 받은 코칭 선택">{dayRows.map((row,index)=><button type="button" key={row.id} aria-pressed={selected?.id===row.id} onClick={()=>setChosenId(String(row.id))}><span>{FEEDBACK_PERIODS.find(p=>p.value===row.period)?.label} 코칭 {index===0&&<small>최근</small>}</span><strong>{feedbackPeriodLabel(row.period,row.period_start)}</strong><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'})} 받음</time></button>)}</div>}
        {selected&&<article className="feedback-history-detail"><header><span>분석 대상 기간</span><h3>{selected.period_start.slice(0,4)} · {feedbackPeriodLabel(selected.period,selected.period_start)}</h3><p>작성 당시 기록을 바탕으로 한 코칭이에요.</p></header><FeedbackContent content={selected.content}/></article>}
      </div>
    </div>
  </section>;
}
