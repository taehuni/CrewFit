import {Link} from 'react-router';
import {useCalendarStatus} from '../auth/useCalendarStatus.js';
import {useCalendarConnection} from '../auth/index.js';
export default function ConnectedServices(){
 const {connect,error,busy,native,eligible,reason}=useCalendarConnection();const status=useCalendarStatus();
 const connected=eligible&&!native&&status.connected;
 return <div className="connected-service-card">
  <div className="connected-service-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6M17 2v6M3 11h18M8 15h3M14 15h2"/></svg></div>
  <div className="connected-service-body">
   <h3>Google Calendar</h3>
   <p>{native?'CrewFit 웹에서 연결하고, 원하는 운동 계획을 내 캘린더에 추가해요.':'선택한 운동 계획을 내 캘린더에 추가해요.'}</p>
   {!eligible?<p className="connected-service-notice" role="status">{reason}</p>:!native&&<p className="connected-service-notice" role="status">{status.checking?'캘린더 연결을 확인하고 있어요…':status.message}</p>}
   <div className="connected-service-actions">
    {eligible?<>
     {connected?<Link className="btn btn-primary" to="/coach?view=plans">저장한 계획에서 일정 추가</Link>:<button type="button" className="btn btn-primary" disabled={busy||(!native&&status.checking)} onClick={connect}>{busy?(native?'웹 여는 중…':'연결 중…'):native?'웹에서 연결·일정 추가':status.checking?'연결 확인 중…':'Google 캘린더 연결'}</button>}
     {native?<Link to="/coach?view=plans">저장한 계획 보기 ↗</Link>:connected?<button type="button" className="btn btn-ghost" disabled={busy} onClick={connect}>{busy?'연결 중…':'다시 연결'}</button>:<button type="button" className="btn btn-ghost" disabled={status.checking||busy} onClick={status.recheck}>{status.checking?'확인 중…':'연결 상태 다시 확인'}</button>}
    </>:<Link to="/coach?view=plans">저장한 계획 보기 ↗</Link>}
   </div>
   {eligible&&<small>{native?'브라우저가 열려요. 같은 CrewFit 계정으로 로그인한 뒤 연결하고, 웹의 저장한 계획에서 일정을 추가해 주세요.':'CrewFit에 로그인한 것과 같은 Google 계정을 선택해 주세요. 다른 계정을 선택하면 연결을 중단하고 이 브라우저에서 로그아웃해요. 브라우저나 홈 화면 앱을 바꾸면 연결 상태를 다시 확인해 주세요.'}</small>}
   {error&&<p role="alert">{error}</p>}
  </div>
 </div>;
}
