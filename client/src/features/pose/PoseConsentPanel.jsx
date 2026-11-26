import {useEffect,useId,useRef} from 'react';
import {Link} from 'react-router';
import {usePoseConsent} from './usePoseConsent.js';
import './pose-consent.css';

export default function PoseConsentPanel({mode='local',recordConsent=false,onRecordConsentChange,onStart,startLabel,disabled=false,startButtonRef,onCancel,children}){
 const id=useId(),needsPhotos=mode==='recognition'||mode==='observation',recurring=mode==='observation';
 const permission=usePoseConsent(needsPhotos?mode:null);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const unavailable=needsPhotos&&!permission.ready;
 async function start(){if(disabled||unavailable)return;if(needsPhotos&&!permission.accepted&&!await permission.grant())return;if(mounted.current)onStart();}
 const buttonLabel=!needsPhotos?startLabel:!permission.ready?permission.saving||permission.loading?permission.label:'분석 설정 확인 필요':!permission.accepted?'사진 분석에 동의하고 시작':startLabel;
 return <section className="pose-consent-panel" aria-label="측정 시작 설정">
  {needsPhotos&&<div className="pose-analysis-choice">
   <p className="pose-analysis-summary">{permission.accepted?'AI 사진 분석 사용 중':recurring?'움직임 관찰을 위해 사진 4장씩 OpenAI로 보내요.':'운동 확인을 위해 사진 4장을 OpenAI로 보내요.'}</p>
   {(permission.loading||permission.saving)&&<p className="pose-consent-status" role="status">{permission.label}</p>}
   <details className="pose-consent-details"><summary>사진 분석 안내</summary><div>
    <p>{recurring?'측정 중 35초 이상 간격으로':'시작할 때'} 사진 4장을 CrewFit 서버를 거쳐 OpenAI로 전송해요. 동의는 계정에 저장되며, 사진 분석 설정에서 중지할 수 있어요.</p>
    <p>항목: 촬영된 신체·주변 배경이 담긴 사진 4장. {recurring?'목적: 선택한 운동의 움직임 관찰.':'목적: 운동 종류와 촬영 방향 확인.'} 시작 버튼을 누른 뒤 암호화된 연결로 전송해요.</p>
    <p>받는 곳: OpenAI OpCo, LLC. 미국 등 OpenAI 처리 지역에서 분석해요. 개인정보 문의는 <a href="https://privacy.openai.com/" target="_blank" rel="noreferrer">OpenAI 개인정보 문의</a>에서 할 수 있어요.</p>
    <p>CrewFit은 분석용 원본 사진을 저장하지 않아요. OpenAI의 기본 보안 로그는 최대 30일 보관될 수 있으며, 법령·안전 검토에 따른 예외가 있어요. <a href="https://developers.openai.com/api/docs/guides/your-data/" target="_blank" rel="noreferrer">OpenAI 보관 정책</a></p>
    <p>이미 보낸 사진의 처리에는 해당 제공자의 정책이 적용돼요. 사용 중지는 앞으로의 사진 분석에 적용돼요.</p>
    {permission.accepted&&<button type="button" className="pose-consent-manage" disabled={disabled||permission.saving} onClick={()=>void permission.revoke()}>사진 분석 사용 중지</button>}
   </div></details>
   {!permission.accepted&&<Link className="pose-consent-alternative" to="/pose?view=local&exercise=squat">사진 전송 없이 측정하기</Link>}
   {permission.error&&<div className="pose-consent-error" role="alert"><p>{permission.error}</p><button type="button" className="btn" disabled={permission.saving||permission.loading} onClick={()=>void permission.retry()}>{permission.retryLabel}</button></div>}
  </div>}
  <label className="pose-record-choice" htmlFor={id+'-record'}>
   <input id={id+'-record'} type="checkbox" checked={recordConsent} disabled={disabled||permission.saving} onChange={event=>onRecordConsentChange(event.target.checked)}/>
   <span><strong>영상 녹화 <small>선택 · 최대 2분 · 소리 없음</small></strong></span>
  </label>
  {recordConsent&&<p className="pose-record-description">종료 후 별도로 보관할 수 있어요. 보관한 영상은 본인만 보며 삭제 전까지 유지돼요.</p>}
  <div className="pose-consent-actions">
   <button ref={startButtonRef} type="button" className="btn btn-primary" disabled={disabled||unavailable} onClick={start}>{buttonLabel}</button>
   {onCancel&&<button type="button" className="btn" onClick={onCancel}>카메라 끄기</button>}
  </div>
  {children}
 </section>;
}
