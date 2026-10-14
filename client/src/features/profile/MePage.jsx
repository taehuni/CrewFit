import {useState} from 'react';
import {Link,Navigate,useSearchParams} from 'react-router';
import {useQuery,useInfiniteQuery} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {supabase} from '../../shared/supabaseClient.js';
import {MemberOverview} from '../../shared/CommunityMedia.jsx';
import {SPORT_LABEL} from '../../shared/ui.jsx';
import {usePostImages} from '../feed/PostImage.jsx';
import {loadMemberRecords,loadMemberCrews} from './memberProfile.js';
import Follows from './Follows.jsx';
import './profile-polish.css';

function Thumbnail({url,content}) {
 const [failed,setFailed]=useState(false);
 return url&&!failed?<img src={url} alt="게시물 사진" loading="lazy" onError={()=>setFailed(true)}/>:<div className="profile-text-cover"><span>MY STORY</span><p>{content}</p></div>;
}
function Content({userId,view}) {
 const q=useInfiniteQuery({queryKey:[view==='posts'?'posts':'members',userId,'profile-content',view],initialPageParam:null,getNextPageParam:p=>p.next,retry:false,queryFn:async({pageParam,signal})=>{
  if(view==='records')return loadMemberRecords(supabase,userId,pageParam,signal);
  if(view==='crews')return loadMemberCrews(supabase,userId,pageParam,signal);
  let request=supabase.from('posts').select('id,content,image_path,created_at,visibility,crews(name)').eq('author_id',userId).order('id',{ascending:false}).limit(21);
  if(pageParam)request=request.lt('id',pageParam);
  const {data,error}=await request.abortSignal(signal);if(error)throw error;
  return {rows:data.slice(0,20),next:data.length>20?data[19].id:undefined};
 }});
 const rows=q.data?.pages.flatMap(p=>p.rows)||[],images=usePostImages(rows.map(r=>r.image_path));
 return <section className="profile-content" aria-label={view==='posts'?'내 게시물':view==='records'?'운동 기록':'참여 크루'}>{q.isPending?<p role="status">불러오는 중…</p>:q.isError?<p role="alert">목록을 불러오지 못했어요. <button onClick={()=>q.refetch()}>다시 시도</button></p>:!rows.length?<div className="profile-empty"><h2>{view==='posts'?'첫 이야기를 남겨 보세요':view==='records'?'오늘의 운동을 기록해 보세요':'함께 운동할 크루를 찾아보세요'}</h2><Link className="btn btn-primary" to={view==='posts'?'/feed/new':view==='records'?'/activities/new':'/crews'}>{view==='posts'?'게시물 쓰기':view==='records'?'운동 기록하기':'크루 둘러보기'}</Link></div>:<div className={`profile-tiles profile-tiles-${view}`}>{rows.map(r=>view==='posts'?<Link className="profile-post-tile" key={r.id} to={`/feed/${r.id}`} state={{feedFrom:'/me'}}><Thumbnail key={images.data?.[r.image_path]||r.id} url={images.data?.[r.image_path]} content={r.content}/><div className="profile-tile-caption"><small>{r.crews?.name||'내 이야기'} · {r.visibility==='public'?'전체 공개':'크루 공개'}</small><p>{r.content}</p><time>{r.created_at.slice(0,10)}</time></div></Link>:view==='records'?<Link className="profile-record-tile" key={r.id} to={`/activities/${r.id}`}><small>{r.performed_on}</small><h3>{SPORT_LABEL[r.sport]||'운동'}</h3><strong>{Math.round(r.duration_sec/60)}분</strong>{r.distance_m!=null&&<span> · {(r.distance_m/1000).toLocaleString()} km</span>}</Link>:r.crews?<Link className="profile-record-tile" key={r.crew_id} to={`/crews/${r.crew_id}`}><small>참여 크루 · {SPORT_LABEL[r.crews.sport]}</small><h3>{r.crews.name}</h3><span>크루 보러 가기 ↗</span></Link>:null)}</div>}{q.hasNextPage&&<button className="btn btn-ghost" disabled={q.isFetching} onClick={()=>q.fetchNextPage()}>더 보기</button>}{images.isError&&<button className="btn btn-ghost" onClick={()=>images.refetch()}>게시물 사진 다시 불러오기</button>}</section>;
}
export default function MePage(){
 const {user,token}=useAuth(),[params,setParams]=useSearchParams();
 const view=['posts','records','crews'].includes(params.get('view'))?params.get('view'):'posts';
 const me=useQuery({queryKey:queryKeys.me(user.id),queryFn:()=>api('/me',{token})});
 if(params.has('calendar'))return <Navigate to={'/me/settings?'+params.toString()+'#profile-connections'} replace/>;
 return <div className="profile-page profile-home"><header className="page-head"><div><span className="section-eyebrow">MY CREWFIT</span><h1>내 프로필</h1></div><div className="profile-actions"><Link className="btn btn-ghost" to="/me/edit">프로필 편집</Link><Link className="btn btn-ghost" to="/me/settings">설정</Link></div></header>{me.isPending?<p role="status">프로필 불러오는 중…</p>:me.isError?<p role="alert">프로필을 불러오지 못했어요. <button onClick={()=>me.refetch()}>다시 시도</button></p>:<><div className="profile-home-summary"><MemberOverview profile={{...me.data.profile,id:user.id}}/><Follows memberId={user.id}/></div><nav className="profile-content-tabs" aria-label="내 활동">{[['posts','게시물'],['records','운동 기록'],['crews','참여 크루']].map(([v,label])=><button key={v} aria-pressed={view===v} onClick={()=>setParams(v==='posts'?{}:{view:v})}>{label}</button>)}<Link to="/feed/new" state={{feedFrom:'/me'}}>＋ 글 쓰기</Link></nav><Content key={view} userId={user.id} view={view}/></>}</div>;
}
