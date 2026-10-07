import {useRef,useState} from 'react';
import {Link,useLocation} from 'react-router';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {supabase} from '../../shared/supabaseClient.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {optionalResult} from '../../shared/community.js';
import {setLike} from './postInteractions.js';
import {SPORTS} from '../crews/crews.js';

export async function loadSummaries(db,ids){let rows=[];for(let i=0;i<ids.length;i+=100){const chunk=await optionalResult(db.rpc('feed_summaries',{p_ids:ids.slice(i,i+100)}));if(chunk===null)return null;rows.push(...chunk);}return Object.fromEntries(rows.map(r=>[r.post_id,r]));}
export function FeedPostLink({postId,comments=false,children,className}){
 const location=useLocation();const from=location.pathname+location.search;
 return <Link className={className} to={`/feed/${postId}${comments?'#comments':''}`} state={{feedFrom:from}} onClick={()=>{try{sessionStorage.setItem('crewfit-scroll:'+from,String(window.scrollY));}catch{}}}>{children}</Link>;
}
export function FeedReaction({post,summary,onRetry}){
 const {user}=useAuth(),cache=useQueryClient(),lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function like(){if(lock.current||!summary)return;lock.current=true;setBusy(true);setError('');try{await setLike(supabase,user.id,post.id,!summary.liked);await Promise.all([cache.invalidateQueries({queryKey:queryKeys.socialSummaryRoot(user.id)}),cache.invalidateQueries({queryKey:queryKeys.postInteractionRoot(user.id,String(post.id))})]);}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 return <><footer className="post-card-footer"><div className="post-reaction-buttons"><button className="reaction-button" aria-label={summary?.liked?'좋아요 취소':'좋아요'} aria-pressed={summary?.liked||false} disabled={busy||!summary} onClick={like}><span aria-hidden="true">{summary?.liked?'♥':'♡'}</span> {summary?Number(summary.likes).toLocaleString():'—'}</button><FeedPostLink postId={post.id} comments>댓글 {summary?Number(summary.comments).toLocaleString():''}</FeedPostLink></div><FeedPostLink postId={post.id}>전체 보기 →</FeedPostLink></footer>{!summary&&<button className="subtle-button" onClick={onRetry}>반응 다시 불러오기</button>}{error&&<p role="alert" className="feed-error">{error}</p>}</>;
}
export function ActivitySummary({activity}){
 if(!activity)return null;
 return <div className="activity-summary"><span className="activity-summary-sport">{SPORTS[activity.sport]}</span>{activity.distance_m!=null&&<strong>{activity.sport==='swimming'?`${activity.distance_m.toLocaleString()} m`:`${(activity.distance_m/1000).toLocaleString(undefined,{maximumFractionDigits:2})} km`}</strong>}<strong>{Math.floor(activity.duration_sec/60)}<small>분</small>{activity.duration_sec%60>0&&<>{activity.duration_sec%60}<small>초</small></>}</strong><span className="activity-summary-label">운동 인증</span></div>;
}
