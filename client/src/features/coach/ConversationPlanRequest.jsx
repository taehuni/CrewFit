import {useState} from 'react';
import {koreaToday} from './planCalendar.js';
import {SPORT_LABEL} from '../../shared/ui.jsx';

export default function ConversationPlanRequest({turn,busy,onRequest}){
 const [date,setDate]=useState(koreaToday),[time,setTime]=useState(''),[sport,setSport]=useState(''),[minutes,setMinutes]=useState(30);
 function submit(e){
  e.preventDefault();
  const fields=new FormData(e.currentTarget);
  const date=fields.get("date"),time=fields.get("time"),sport=fields.get("sport"),minutes=fields.get("minutes");
  onRequest(`이 대화 내용을 참고해서 아래 조건에 맞는 운동 일정 1개를 저장 가능한 계획으로 제안해줘. 아직 저장하지 말고 준비 운동, 본운동, 정리 운동을 메모에 구체적으로 적어줘.\n날짜: ${date} (한국시간)\n시작 시각: ${time}\n종목: ${SPORT_LABEL[sport]} (${sport})\n운동 시간: ${minutes}분\n참고할 이전 질문: ${turn.message.slice(0,500)}\n참고할 이전 답변: ${turn.answer.slice(0,900)}`);
 }
 return <form className="coach-proposals conversation-plan-request" onSubmit={submit}>
  <h3>이 대화를 운동 계획으로</h3><p>운동할 일정을 정하면 저장 가능한 계획을 제안해요. 생성 후 내용을 확인하고 저장할 수 있어요.</p>
  <fieldset disabled={busy}><div className="coach-fields">
   <label>날짜<input name="date" type="date" required min={koreaToday()} max="2100-12-31" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>시작 시각<input name="time" type="time" required value={time} onChange={e=>setTime(e.target.value)}/></label>
   <label>종목<select name="sport" required value={sport} onChange={e=>setSport(e.target.value)}><option value="">운동 선택</option>{Object.entries(SPORT_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label>운동 시간 · 분<input name="minutes" type="number" required min={5} max={240} value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
  </div><button className="btn btn-primary" disabled={busy}>{busy?'계획을 만들고 있어요…':'저장 가능한 계획으로 제안받기'}</button></fieldset>
 </form>;
}
