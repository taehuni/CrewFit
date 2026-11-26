import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './ai-data-notice.css';

export default function AiDataNotice({mode='conversation'}){
 const report=mode==='report',id=useId(),dialog=useRef(null),trigger=useRef(null);
 const [open,setOpen]=useState(false);
 const title=report?'리포트에 참고하는 정보':'답변에 참고하는 정보';
 useEffect(()=>{
  const modal=dialog.current;
  if(!open||!modal)return;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  if(!modal.open)modal.showModal();
  const handleBack=event=>{event.preventDefault();modal.close();};
  window.addEventListener('crewfit:surface-back',handleBack);
  return()=>{window.removeEventListener('crewfit:surface-back',handleBack);if(modal.open)modal.close();document.body.style.overflow=overflow;trigger.current?.focus({preventScroll:true});};
 },[open]);
 return <section className="ai-data-notice" aria-label="AI 정보 사용 안내">
  <button ref={trigger} type="button" className="ai-data-trigger" aria-haspopup="dialog" onClick={()=>setOpen(true)}><span aria-hidden="true">ⓘ</span><span>{title}</span><span className="ai-data-provider">OpenAI</span></button>
  {createPortal(<dialog ref={dialog} className="ai-data-dialog" aria-labelledby={id+'-title'} onClose={()=>setOpen(false)}>
   <header><h2 id={id+'-title'}>{title}</h2><button type="button" autoFocus aria-label="정보 사용 안내 닫기" onClick={()=>dialog.current?.close()}>닫기</button></header>
   <div className="ai-data-content">
    <p>{report?'새 리포트를 만들거나 다시 분석할 때 다음 정보가':'메시지를 보내면 입력한 질문과 다음 정보가'} CrewFit 서버를 거쳐 <strong>OpenAI</strong>로 전달되어 {report?'리포트':'답변'} 생성에 사용돼요.</p>
    {report?<ul>
     <li><strong>선택한 기간의 운동·식단 기록</strong><span>선택한 일·주·월의 운동 날짜·종목·시간·거리·상세 내용·메모, 식단 항목과 메모를 참고해요.</span></li>
     <li><strong>헬스 세트와 현재 목표</strong><span>그 기간의 운동명·세트·횟수·중량, 선택한 기간 단위에 맞는 현재 활성 운동 목표, 주 운동과 목표 메모를 참고해요.</span></li>
    </ul>:<ul>
     <li><strong>최근 28일의 운동·식단 일부</strong><span>운동 날짜·종목·시간·거리·메모는 최근 100개까지, 식단 항목과 메모는 최근 50개까지 참고해요.</span></li>
     <li><strong>목표와 운동·식사 선호</strong><span>현재 활성 운동 목표 일부(최대 20개), 관심 운동과 목표 메모, 식사 목표·선호·피할 음식·알레르기 설정을 참고해요.</span></li>
     <li><strong>질문과 대화</strong><span>지금 보낸 질문과 최근 또는 이어가는 대화의 질문·답변을 최대 8회까지 참고해요.</span></li>
    </ul>}
    {report&&<p>식사 선호·알레르기 설정과 코칭 대화는 리포트 자료로 자동 첨부하지 않아요.</p>}
    <div className="ai-data-input-note"><strong>자동 첨부와 직접 입력은 달라요</strong><p>GPS 경로, 계정 이메일, 프로필의 실명은 자동 첨부하지 않아요.</p><p>{report?'기록·목표 메모 등':'질문·대화·기록·목표 메모 등'} 직접 적은 내용은 함께 전달돼요. 그 안의 이름·연락처·건강정보는 자동으로 지워지지 않아요.</p></div>
   </div>
  </dialog>,document.body)}
 </section>;
}
