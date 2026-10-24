import {useState, useEffect} from 'react';
import {monthDays, moveMonth, koreaToday} from './planCalendar.js';

export default function PlanCalendar({plans, selected, onSelect}) {
  const [month, setMonth] = useState(selected.slice(0, 7));
  useEffect(() => setMonth(selected.slice(0, 7)), [selected]);
  const counts = new Map();
  for (const plan of plans) counts.set(plan.scheduled_on, (counts.get(plan.scheduled_on) || 0) + 1);
  const today = koreaToday();
  const dates = [...counts.keys()].sort();
  const next = dates.find(date => date >= today) || dates.at(-1);
  return <section className="plan-calendar" aria-label="저장한 운동 계획 달력">
    <div className="plan-calendar-head"><button type="button" aria-label="이전 달" onClick={() => setMonth(moveMonth(month, -1))}>‹</button><strong aria-live="polite">{Number(month.slice(0,4))}년 {Number(month.slice(5))}월</strong><button type="button" aria-label="다음 달" onClick={() => setMonth(moveMonth(month, 1))}>›</button></div>
    <div className="plan-calendar-week" aria-hidden="true">{['월','화','수','목','금','토','일'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="plan-calendar-days">{monthDays(month).map((date, i) => date ? <button key={date} type="button" aria-label={`${date}, 운동 계획 ${counts.get(date) || 0}개`} aria-pressed={date === selected} aria-current={date === today ? 'date' : undefined} onClick={() => onSelect(date)}><span>{Number(date.slice(8))}</span><i aria-hidden="true" className={counts.has(date) ? 'has-plan' : ''}/></button> : <span key={`blank-${i}`}/>)}</div>
    <div className="plan-calendar-footer"><small>● 계획 있는 날</small><button type="button" onClick={() => onSelect(today)}>오늘</button>{next && <button type="button" onClick={() => onSelect(next)}>가까운 계획</button>}</div>
  </section>;
}
