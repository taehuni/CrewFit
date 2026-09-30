import { Link,useSearchParams } from 'react-router';
import { useQuery,useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { KINDS,feedContext,loadPosts } from './posts.js';
import './feed.css';
import { PostImage,usePostImages } from './PostImage.jsx';

export default function FeedPage(){
  const {user}=useAuth();const [params,setParams]=useSearchParams();
  const crewId=params.get('crew') || null,kind=params.get('kind') || '';
  const context=useQuery({queryKey:queryKeys.feedContext(user.id,crewId),queryFn:()=>feedContext(supabase,crewId),retry:false,staleTime:0});
  const query=useInfiniteQuery({queryKey:queryKeys.postList(user.id,crewId,kind),initialPageParam:null,
    queryFn:({pageParam})=>loadPosts(supabase,crewId,kind,pageParam),getNextPageParam:page=>page.next,retry:false,gcTime:0});
  const rows=query.data?.pages.flatMap(page=>page.rows) || [];
  const images=usePostImages(rows.map(post=>post.image_path));
  return <div className="feed-page">
    <header className="feed-heading"><div><h1>{crewId ? `${context.data?.crew?.name || '크루'} 피드` : '피드'}</h1><p>{crewId ? '크루 전용 글은 승인된 크루원에게만 보여요.' : '회원 모두에게 공개된 운동 이야기'}</p></div>
      {context.data?.canWrite && <Link className="btn btn-primary" to={`/feed/new${crewId?`?crew=${crewId}`:''}`}>글 쓰기</Link>}
    </header>
    {crewId && <p className="feed-links"><Link to={`/crews/${crewId}`}>크루 상세</Link><Link to="/feed">전체 피드</Link></p>}
    {crewId && <p className="feed-note">고정글을 먼저 보여줍니다. 고정 상태가 바뀌면 새로고침해 주세요. <button className="btn btn-ghost" disabled={query.isFetching} onClick={()=>query.refetch()}>피드 새로고침</button></p>}
    {context.isError && <div role="alert"><p>{context.error.message}</p><button className="btn btn-ghost" onClick={()=>context.refetch()}>권한 다시 조회</button></div>}
    {context.data && !context.data.canWrite && <p className="feed-note">크루 글은 크루장 또는 글 작성 권한을 받은 크루원만 쓸 수 있어요.</p>}
    <div className="feed-filters" role="group" aria-label="글 종류">{[['','전체'],...Object.entries(KINDS)].map(([value,label])=><button key={value} aria-pressed={kind===value} onClick={()=>{const next=new URLSearchParams(params);value?next.set('kind',value):next.delete('kind');setParams(next);}}>{label}</button>)}</div>
    {query.isPending && <p role="status">글을 불러오고 있어요.</p>}
    {query.isError && <div role="alert"><p>{query.error.message}</p><button className="btn btn-ghost" disabled={query.isFetching} onClick={()=>query.isFetchNextPageError?query.fetchNextPage():query.refetch()}>다시 조회</button></div>}
    {!query.isPending && !query.isError && !rows.length && <p className="feed-empty">아직 볼 수 있는 글이 없어요.</p>}
    <div className="feed-list">{rows.map(post=><article key={post.id} className="feed-post">
      {crewId && post.is_pinned && <p className="post-pin-label">고정글</p>}
      <p className="feed-meta">{KINDS[post.kind]} · <Link to={`/users/${post.author_id}`}>{post.profiles?.nickname || '회원'}</Link> · {new Date(post.created_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}{post.crews && ` · ${post.crews.name}`} · {post.visibility==='crew'?'크루 전용':'전체 공개'}</p>
      <Link to={`/feed/${post.id}`} className="feed-preview">{post.content}</Link>
      {post.activity_id && <p className="feed-note">운동 기록 첨부 · 상세에서 확인</p>}
      {post.image_path && <PostImage key={images.data?.[post.image_path] || post.image_path} url={images.data?.[post.image_path]} loading={images.isFetching} onRetry={()=>images.refetch()}/>}
    </article>)}</div>
    {query.hasNextPage && <button className="btn btn-ghost" disabled={query.isFetching} onClick={()=>query.fetchNextPage()}>글 더 보기</button>}
  </div>;
}
