import {usePoseConsent} from './usePoseConsent.js';
import './pose-consent.css';
export default function PosePrivacySettings({expanded=false}){
 const permission=usePoseConsent('recognition');
 const rows=[['recognition','운동 종류 자동 인식'],['observation','측정 중 사진 관찰']].map(([scope,title])=>({scope,title,...permission.stateFor(scope)}));
 const busy=rows.some(row=>row.saving||row.loading),errors=[...new Set(rows.map(row=>row.error).filter(Boolean))];
 const content=<div>
  <p>선택은 계정에 저장돼요. 여기서 사용을 중지할 수 있고, 다시 사용할 때는 측정 시작 전에 동의해 주세요.</p>
  {rows.map(row=><div className="pose-privacy-row" key={row.scope}><div><strong>{row.title}</strong><span role="status">{row.status==='accepted'?'동의함 · 같은 분석에는 다시 묻지 않아요':row.label}</span></div>
   {row.accepted&&<button type="button" className="pose-consent-manage" disabled={busy} onClick={()=>void permission.revoke(row.scope)}>사용 중지</button>}
  </div>)}
  {errors.length>0&&<div className="pose-consent-error" role="alert"><p>{errors.join(' ')}</p><p className="pose-consent-error-help">설정을 확인할 때까지 사진 분석은 시작하지 않아요.</p><button type="button" className="btn" disabled={busy} onClick={()=>void permission.retryAll()}>다시 시도</button></div>}
 </div>;
 return expanded?<div className="pose-privacy-settings is-expanded">{content}</div>:<details className="pose-privacy-settings"><summary>사진 분석 설정</summary>{content}</details>;
}
