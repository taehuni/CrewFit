import {useState,useRef} from 'react';
import {useNavigate} from 'react-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {supabase} from '../../shared/supabaseClient.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {optionalResult,saveResult,setupMessage} from '../../shared/community.js';
export default function PostSafety({post}){
 const {user}=useAuth(),navigate=useNavigate(),cache=useQueryClient(),lock=useRef(false);
 const [mode,setMode]=useState(''),[reason,setReason]=useState('spam'),[detail,setDetail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 if(post.author_id===user.id)return null;
 async function submit(e){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  if(mode==='block'){const result=await supabase.from('member_blocks').insert({user_id:user.id,blocked_id:post.author_id});if(result.error?.code!=='23505')await saveResult(Promise.resolve(result));await cache.invalidateQueries({queryKey:queryKeys.postsRoot(user.id)});await cache.invalidateQueries({queryKey:['community',user.id]});navigate(post.crew_id?`/crews/${post.crew_id}`:'/feed',{replace:true});}
  else{const r=await supabase.from('content_reports').insert({reporter_id:user.id,post_id:post.id,reason,detail:detail.trim()});if(r.error?.code==='23505')setMessage('이미 접수한 신고예요. 내 설정에서 상태를 확인할 수 있어요.');else{await saveResult(Promise.resolve(r));setMessage('신고를 접수했어요. 내 설정에서 처리 상태를 확인할 수 있어요.');}setMode('');await cache.invalidateQueries({queryKey:queryKeys.reports(user.id)});}
 }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 return <details className="post-safety"><summary>신고·차단</summary><div className="feed-actions"><button className="btn btn-ghost" onClick={()=>{setMode('report');setError('');}}>게시글 신고</button><button className="btn btn-ghost" onClick={()=>{setMode('block');setError('');}}>작성자 차단</button></div>
 {mode&&<form className="card stack" onSubmit={submit}>{mode==='report'?<><label>신고 사유<select value={reason} onChange={e=>setReason(e.target.value)}><option value="spam">광고·스팸</option><option value="abuse">욕설·괴롭힘</option><option value="privacy">개인정보 노출</option><option value="other">기타</option></select></label><label>추가 설명 · 선택<textarea maxLength={1000} rows={3} value={detail} onChange={e=>setDetail(e.target.value)}/></label></>:<p>{post.profiles?.nickname||'이 회원'} 님을 차단할까요? 서로의 게시글과 댓글이 보이지 않으며 내 설정에서 해제할 수 있어요.</p>}<div className="feed-actions"><button className="btn btn-primary" disabled={busy}>{busy?'처리 중…':mode==='report'?'신고 접수':'차단하기'}</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setMode('')}>취소</button></div></form>}
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</details>;
}
export function CommunitySettings(){const {user}=useAuth(),cache=useQueryClient(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const blocks=useQuery({queryKey:queryKeys.blocks(user.id),queryFn:()=>optionalResult(supabase.from('member_blocks').select('blocked_id,profiles!member_blocks_blocked_id_fkey(nickname)').eq('user_id',user.id)),retry:false});
 const reports=useQuery({queryKey:queryKeys.reports(user.id),queryFn:()=>optionalResult(supabase.from('content_reports').select('id,status,created_at').eq('reporter_id',user.id).order('id',{ascending:false}).limit(30)),retry:false});
 async function unblock(id){setBusy(true);setError('');try{await saveResult(supabase.from('member_blocks').delete().eq('user_id',user.id).eq('blocked_id',id));await cache.invalidateQueries({queryKey:['community',user.id]});await cache.invalidateQueries({queryKey:queryKeys.postsRoot(user.id)});}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <details className="card community-settings"><summary>차단한 회원·신고 내역</summary>{error&&<p role="alert">{error}</p>}<h3>차단한 회원</h3>{blocks.isError?<button onClick={()=>blocks.refetch()}>다시 불러오기</button>:blocks.isPending?<p>불러오는 중…</p>:blocks.data===null?<p>{setupMessage}</p>:!blocks.data?.length?<p className="muted">차단한 회원이 없어요.</p>:<ul>{blocks.data.map(b=><li key={b.blocked_id}><span>{b.profiles?.nickname||'회원'}</span><button className="btn btn-ghost" disabled={busy} onClick={()=>unblock(b.blocked_id)}>차단 해제</button></li>)}</ul>}
 <h3>내 신고 내역</h3>{reports.isError?<button onClick={()=>reports.refetch()}>다시 불러오기</button>:reports.isPending?<p>불러오는 중…</p>:reports.data===null?<p>{setupMessage}</p>:!reports.data?.length?<p className="muted">접수한 신고가 없어요.</p>:<ul>{reports.data.map(r=><li key={r.id}><time>{new Date(r.created_at).toLocaleDateString('ko-KR')}</time><span>{{received:'접수됨',reviewed:'검토 중',resolved:'처리 완료'}[r.status]}</span></li>)}</ul>}</details>;
}
