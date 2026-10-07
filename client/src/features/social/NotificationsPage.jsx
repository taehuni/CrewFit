import {Link} from 'react-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {useAuth} from '../auth/index.js';
import {supabase} from '../../shared/supabaseClient.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {optionalResult,saveResult,setupMessage} from '../../shared/community.js';
const labels={comment:'내 글에 댓글을 남겼어요.',like:'내 글을 좋아해요.',join_request:'크루 가입을 요청했어요.',join_approved:'크루 가입을 승인했어요.'};
function useNotifications(){const {user}=useAuth();return useQuery({queryKey:queryKeys.notifications(user.id),queryFn:()=>optionalResult(supabase.from('notifications').select('id,actor_id,kind,post_id,crew_id,is_read,created_at,profiles!notifications_actor_id_fkey(nickname)').order('id',{ascending:false}).limit(100)),retry:false,staleTime:30000,refetchInterval:60000});}
export function NotificationLink(){const q=useNotifications();const count=q.data?.filter(n=>!n.is_read).length||0;return <Link className="notification-link" to="/notifications" aria-label={`알림${count?`, 읽지 않은 알림 ${count}개`:''}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4"/></svg>{count>0&&<span className="notification-dot"/>}</Link>;}
export default function NotificationsPage(){const q=useNotifications(),{user}=useAuth(),cache=useQueryClient();const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function read(id){setBusy(true);setError('');try{let query=supabase.from('notifications').update({is_read:true}).eq('recipient_id',user.id);if(id)query=query.eq('id',id);else query=query.in('id',(q.data||[]).filter(n=>!n.is_read).map(n=>n.id));await saveResult(query);await cache.invalidateQueries({queryKey:queryKeys.notifications(user.id)});}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="social-page"><header className="page-head"><div><h1>알림</h1><p className="muted">함께 운동하는 사람들의 새로운 소식</p></div><button className="btn btn-ghost" disabled={busy||!q.data?.some(n=>!n.is_read)} onClick={()=>read()}>모두 읽음</button></header>
 {error&&<p role="alert">{error}</p>}{q.isPending?<p role="status">소식을 불러오고 있어요.</p>:q.isError?<button className="btn btn-ghost" onClick={()=>q.refetch()}>알림 다시 불러오기</button>:q.data===null?<p className="empty-state">{setupMessage}</p>:!q.data?.length?<div className="empty-state"><h2>아직 새 소식이 없어요</h2><p>댓글, 좋아요, 크루 가입 소식이 이곳에 모여요.</p><Link className="btn btn-primary" to="/feed">운동 이야기 둘러보기</Link></div>:<ul className="notification-list">{q.data.map(n=><li key={n.id} data-unread={!n.is_read}><Link onClick={()=>read(n.id)} to={n.post_id?`/feed/${n.post_id}${n.kind==='comment'?'#comments':''}`:`/crews/${n.crew_id}`}><strong>{n.profiles?.nickname||'회원'}</strong><p>{labels[n.kind]}</p><time>{new Date(n.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time></Link>{!n.is_read&&<span className="unread-label">새 소식</span>}</li>)}</ul>}
 <p className="muted small">최근 소식 100개를 보여드려요.</p></div>;
}
