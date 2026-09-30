import { Link } from 'react-router';
import { useRef,useState } from 'react';
import { useInfiniteQuery,useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { likeSummary,interactionPage,setLike,saveComment,deleteComment } from './postInteractions.js';

export default function PostInteractions({post}) {
  const {user}=useAuth(),cache=useQueryClient();
  const [showLikes,setShowLikes]=useState(false),[content,setContent]=useState(''),[editing,setEditing]=useState(null),[draft,setDraft]=useState('');
  const [confirmation,setConfirmation]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const lock=useRef(false);
  const key=type=>queryKeys.postInteraction(user.id,String(post.id),type);
  const likes=useQuery({queryKey:key('summary'),queryFn:()=>likeSummary(supabase,user.id,post.id),retry:false,gcTime:0});
  const comments=useInfiniteQuery({queryKey:key('comments'),initialPageParam:null,queryFn:({pageParam})=>interactionPage(supabase,post.id,'comments',pageParam),getNextPageParam:page=>page.next,retry:false,gcTime:0});
  const people=useInfiniteQuery({queryKey:key('likes'),initialPageParam:null,queryFn:({pageParam})=>interactionPage(supabase,post.id,'likes',pageParam),getNextPageParam:page=>page.next,retry:false,gcTime:0,enabled:showLikes});
  async function refresh(){await cache.invalidateQueries({queryKey:queryKeys.postInteractionRoot(user.id,String(post.id))});}
  async function act(work,success){if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');
    try{await work();success?.();await refresh();}catch(cause){setError(cause.message);}finally{lock.current=false;setBusy(false);}}
  const rows=comments.data?.pages.flatMap(page=>page.rows) || [];
  return <section className="post-interactions" aria-label="댓글과 좋아요" aria-busy={busy}>
    <div className="feed-actions">
      <button className="btn btn-ghost like-toggle" disabled={busy || likes.isFetching || !likes.data || likes.isError} aria-pressed={likes.data?.liked || false} onClick={()=>act(()=>setLike(supabase,user.id,post.id,!likes.data.liked))}>{likes.data?.liked?'좋아요 취소':'좋아요'}{!likes.isError && likes.data?` · ${likes.data.count}`:''}</button>
      <button className="btn btn-ghost" aria-expanded={showLikes} onClick={()=>setShowLikes(value=>!value)}>좋아요한 회원</button>
      <button className="btn btn-ghost" disabled={busy || comments.isFetching || likes.isFetching} onClick={refresh}>댓글·좋아요 새로고침</button>
    </div>
    {likes.isError && <p role="alert">좋아요를 불러오지 못했어요. 새로고침해 주세요.</p>}
    {showLikes && <div className="post-likers">{people.isPending?<p role="status">회원을 불러오고 있어요.</p>:people.isError?<p role="alert">회원 목록을 불러오지 못했어요. 새로고침해 주세요.</p>:<><ul>{people.data?.pages.flatMap(page=>page.rows).map(person=><li key={person.user_id}><Link to={`/users/${person.user_id}`}>{person.profiles?.nickname || '회원'}</Link></li>)}</ul>{!people.data?.pages[0]?.rows.length && <p>아직 좋아요한 회원이 없어요.</p>}</>}
      {people.hasNextPage && <button className="btn btn-ghost" disabled={people.isFetching} onClick={()=>people.fetchNextPage()}>회원 더 보기</button>}</div>}
    <h2>댓글</h2>
    <form className="comment-form" onSubmit={event=>{event.preventDefault();act(()=>saveComment(supabase,user.id,post.id,content),()=>{setContent('');setMessage('댓글을 등록했어요.');});}}>
      <label htmlFor="new-comment">댓글 쓰기</label><textarea id="new-comment" value={content} onChange={event=>setContent(event.target.value)} required maxLength={1000} rows={3} disabled={busy}/>
      <button className="btn btn-primary" disabled={busy || !content.trim()}>댓글 등록</button>
    </form>
    {error && <p role="alert" className="feed-error">{error}</p>}{message && <p role="status">{message}</p>}
    {comments.isPending?<p role="status">댓글을 불러오고 있어요.</p>:comments.isError?<p role="alert">댓글을 불러오지 못했어요. 새로고침해 주세요.</p>:!rows.length?<p>첫 댓글을 남겨보세요.</p>:null}
    <ul className="comment-list">{rows.map(comment=><li key={comment.id}>
      <p className="feed-meta"><Link to={`/users/${comment.author_id}`}>{comment.profiles?.nickname || '회원'}</Link> · {new Date(comment.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>
      {editing?.id===comment.id?<form className="comment-edit" onSubmit={event=>{event.preventDefault();act(()=>saveComment(supabase,user.id,post.id,draft,editing),()=>{setEditing(null);setMessage('댓글을 수정했어요.');});}}>
        <label>댓글 수정<textarea value={draft} onChange={event=>setDraft(event.target.value)} required maxLength={1000} rows={3} disabled={busy}/></label>
        <button className="btn btn-primary" disabled={busy}>수정 저장</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setEditing(null)}>취소</button>
      </form>:<><p className="comment-content">{comment.content}</p><div className="feed-actions">
        {comment.author_id===user.id && <button className="btn btn-ghost" disabled={busy} onClick={()=>{setEditing(comment);setDraft(comment.content);setConfirmation(null);}}>댓글 수정</button>}
        {(comment.author_id===user.id || post.crews?.owner_id===user.id) && <button className="btn btn-ghost" disabled={busy} onClick={()=>setConfirmation(comment)}>댓글 삭제</button>}
      </div></>}
    </li>)}</ul>
    {comments.hasNextPage && <button className="btn btn-ghost" disabled={comments.isFetching || busy} onClick={()=>comments.fetchNextPage()}>댓글 더 보기</button>}
    {confirmation && <div className="comment-confirm" role="group" aria-label="댓글 삭제 확인"><p>댓글을 삭제할까요? 삭제하면 복구할 수 없어요.</p>
      <button className="btn btn-ghost" disabled={busy} onClick={()=>setConfirmation(null)}>취소</button><button className="btn btn-primary" disabled={busy} onClick={()=>act(()=>deleteComment(supabase,user.id,post.id,confirmation),()=>{setConfirmation(null);setMessage('댓글을 삭제했어요.');})}>댓글 삭제 확인</button></div>}
  </section>;
}
