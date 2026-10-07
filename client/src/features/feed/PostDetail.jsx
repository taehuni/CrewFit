import { useRef,useState } from 'react';
import { Link,useNavigate,useParams,useLocation } from 'react-router';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { KINDS,feedUrl,loadPost,deletePost,canPinPost,setPostPinned } from './posts.js';
import './feed.css';
import StoredPostImage from './PostImage.jsx';
import ActivityAttachment from './ActivityAttachment.jsx';
import PostInteractions from './PostInteractions.jsx';
import PostAuthor from './PostAuthor.jsx';
import {PostSafety} from '../social/index.js';
import { SavedRoute } from '../tracking/index.js';

export default function PostDetail(){
  const {user}=useAuth(),{postId}=useParams(),cache=useQueryClient(),navigate=useNavigate();
  const location=useLocation();
  const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const running=useRef(false);
  const query=useQuery({queryKey:queryKeys.post(user.id,postId),queryFn:()=>loadPost(supabase,postId),retry:false,staleTime:0,gcTime:0});
  const post=query.data;
  const from=location.state?.feedFrom;
  const back=typeof from==='string'&&/^\/(crews\/[1-9]\d*|feed)(\?[^#]*)?$/.test(from)?from:post?.crew_id?`/crews/${post.crew_id}`:'/feed';
  const [message,setMessage]=useState('');
  async function pin(){if(running.current)return;running.current=true;setBusy(true);setError('');setMessage('');
    try{await setPostPinned(supabase,user.id,post,!post.is_pinned);setMessage(post.is_pinned?'고정을 해제했어요.':'크루 피드 상단에 고정했어요.');await cache.invalidateQueries({queryKey:queryKeys.postsRoot(user.id)});}
    catch(cause){setError(cause.message);}finally{running.current=false;setBusy(false);}}
  async function remove(){if(running.current)return;running.current=true;setBusy(true);setError('');
    try{await deletePost(supabase,user.id,post);await cache.invalidateQueries({queryKey:queryKeys.postsRoot(user.id)});navigate(back,{replace:true,state:{restoreFeed:true}});}
    catch(cause){setError(cause.message);}finally{running.current=false;setBusy(false);}}
  return <div className="feed-page post-detail-page"><header className="feed-heading"><h1>운동 이야기</h1><Link to={back} state={{restoreFeed:true}}>← {back.startsWith('/crews/')?'크루로 돌아가기':'피드로 돌아가기'}</Link></header>
    {query.isPending?<p role="status">글을 불러오고 있어요.</p>:query.isError?<div role="alert"><p>{query.error.message}</p><button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 조회</button></div>:!post?<p>글이 삭제되었거나 볼 수 있는 권한이 없어요.</p>:<>
      <article className="feed-post"><header className="post-card-heading"><PostAuthor authorId={post.author_id} nickname={post.profiles?.nickname || '회원'} createdAt={post.created_at} visibility={post.visibility}/><span className="post-kind">{KINDS[post.kind] || '인증'} 글</span></header>
        {post.is_pinned && <p className="post-pin-label">크루 고정글</p>}
        {post.crews && <Link to={feedUrl(post.crew_id)}>{post.crews.name}</Link>}<p className="post-content">{post.content}</p>
        {post.activity_id && <ActivityAttachment key={post.activity_id} postId={post.id}/>}
        {post.activity_id && post.include_route && <SavedRoute key={`route:${post.id}:${post.activity_id}`} postId={post.id}/>}
        {!post.activity_id && post.kind==='log' && <p className="feed-note">첨부된 운동 기록이 없어요.</p>}
        {post.image_path && <StoredPostImage path={post.image_path}/>}</article>
      <div className="feed-actions">{post.author_id===user.id && Object.hasOwn(KINDS,post.kind) && <Link className="btn btn-ghost" state={{feedFrom:back}} to={`/feed/${post.id}/edit`}>수정</Link>}
        {canPinPost(post,user.id) && <button className="btn btn-ghost post-pin-toggle" disabled={busy || query.isFetching} aria-pressed={post.is_pinned} onClick={pin}>{post.is_pinned?'고정 해제':'크루 상단 고정'}</button>}
        {(post.author_id===user.id || post.crews?.owner_id===user.id) && <button className="btn btn-ghost" disabled={busy} onClick={()=>setConfirm(true)}>삭제</button>}</div>
      {confirm && <div className="post-confirm" role="group" aria-label="글 삭제 확인"><p>이 글을 삭제할까요? 삭제한 글은 복구할 수 없어요.</p><button className="btn btn-ghost" disabled={busy} onClick={()=>setConfirm(false)}>취소</button><button className="btn btn-primary" disabled={busy} onClick={remove}>{busy?'삭제 중…':'삭제 확인'}</button></div>}
      {error && <p className="feed-error" role="alert">{error}</p>}
      {error && <button className="btn btn-ghost" disabled={busy || query.isFetching} onClick={()=>{setError('');query.refetch();}}>글 다시 조회</button>}
      {message && <p role="status">{message}</p>}
      <PostInteractions key={`${user.id}:${post.id}`} post={post}/>
      <PostSafety post={post}/>
    </>}
  </div>;
}
