import {Link,useSearchParams} from 'react-router';
import {useCalendarConnection} from '../auth/index.js';
export default function ConnectedServices(){
 const {connect,error,busy}=useCalendarConnection();const [params]=useSearchParams();
 return <div className="connected-service-card"><div className="connected-service-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6M17 2v6M3 11h18M8 15h3M14 15h2"/></svg></div><div className="connected-service-body"><h3>Google Calendar</h3><p>선택한 운동 계획을 내 캘린더에 추가해요.</p>{params.get('calendar')==='connected'&&<p className="connected-service-notice" role="status">구글 연결 절차를 마쳤어요. 저장한 계획에서 일정을 추가해 보세요.</p>}<div className="connected-service-actions"><button className="btn btn-ghost" disabled={busy} onClick={connect}>{busy?'연결 중…':'연결·재연결'}</button><Link to="/home?coach=plans">저장한 계획 보기 ↗</Link></div><small>일정은 직접 선택해야 추가돼요. 권한이 만료되면 여기서 다시 연결할 수 있어요.</small>{error&&<p role="alert">{error}</p>}</div></div>;
}
