import { Link,useSearchParams,useLocation } from 'react-router';
import {useEffect,useRef} from 'react';
import { useQuery,useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { KINDS,feedContext,loadPosts } from './posts.js';
import './feed.css';
import { PostImage,usePostImages } from './PostImage.jsx';
import CrewMark from '../../shared/CrewMark.jsx';
import PostAuthor from './PostAuthor.jsx';
import {loadSummaries,FeedPostLink,FeedReaction,ActivitySummary} from './FeedCardTools.jsx';
import FeedSidebar from './FeedSidebar.jsx';

export default function FeedPage({embeddedCrewId=null}){
  const {user}=useAuth();const [params,setParams]=useSearchParams();
  const location=useLocation(),restored=useRef('');
  const embedded=embeddedCrewId!==null;
  const crewId=embedded ? String(embeddedCrewId) : params.get('crew') || null,kind=params.get('kind') || '';
  const Heading=embedded?'h2':'h1';
  const context=useQuery({queryKey:queryKeys.feedContext(user.id,crewId),queryFn:()=>feedContext(supabase,crewId),retry:false,staleTime:0});
  const query=useInfiniteQuery({queryKey:queryKeys.postList(user.id,crewId,kind),initialPageParam:null,
    queryFn:({pageParam})=>loadPosts(supabase,crewId,kind,pageParam),getNextPageParam:page=>page.next,retry:false,gcTime:300000});
  const rows=query.data?.pages.flatMap(page=>page.rows) || [];
  const images=usePostImages(rows.map(post=>post.image_path));
  const ids=rows.map(p=>p.id);
  const summaries=useQuery({queryKey:queryKeys.socialSummary(user.id,ids),queryFn:()=>loadSummaries(supabase,ids),enabled:ids.length>0,retry:false,staleTime:0});
  useEffect(()=>{if(!location.state?.restoreFeed || restored.current===location.key || query.isFetching || images.isFetching || !rows.length)return;restored.current=location.key;let y=0;try{y=Number(sessionStorage.getItem('crewfit-scroll:'+location.pathname+location.search))||0;}catch{}const frame=requestAnimationFrame(()=>window.scrollTo(0,y));return()=>cancelAnimationFrame(frame);},[location.key,location.state,query.isFetching,images.isFetching,rows.length]);
  return <div className={embedded?'feed-embedded-layout':'feed-layout'}><div className={`feed-page${embedded?' crew-inline-feed':''}`}>
    <header className="feed-heading"><div><Heading>{embedded ? '크루 피드' : crewId ? `${context.data?.crew?.name || '크루'} 피드` : '피드'}</Heading><p>{crewId ? '공개 운동 이야기 · 크루 전용 글은 승인된 크루원에게만 보여요.' : '회원 모두에게 공개된 운동 이야기'}</p></div>
      {context.data?.canWrite && <Link className="btn btn-primary" state={{feedFrom:location.pathname+location.search}} to={`/feed/new${crewId?`?crew=${crewId}`:''}`}>글 쓰기</Link>}
    </header>
    {!embedded && context.data?.crew && <div className="crew-identity crew-feed-identity"><CrewMark name={context.data.crew.name} sport={context.data.crew.sport} large/><div>{context.data.crew.name}<small>우리 크루의 운동 이야기</small></div></div>}
    {!embedded && crewId && <p className="feed-links"><Link to={`/crews/${crewId}`}>크루 상세</Link><Link to="/feed">전체 피드</Link></p>}
    {crewId && <div className="feed-toolbar"><span className="muted small">크루의 새로운 이야기</span><button className="subtle-button" disabled={query.isFetching} onClick={()=>{query.refetch();summaries.refetch();}}>새로고침</button></div>}
    {context.isError && <div role="alert"><p>{context.error.message}</p><button className="btn btn-ghost" onClick={()=>context.refetch()}>권한 다시 조회</button></div>}
    {!embedded && context.data && !context.data.canWrite && <p className="feed-note">크루 글은 크루장 또는 글 작성 권한을 받은 크루원만 쓸 수 있어요.</p>}
    <div className="feed-filters" role="group" aria-label="글 종류">{[['','전체'],...Object.entries(KINDS)].map(([value,label])=><button key={value} aria-pressed={kind===value} onClick={()=>{const next=new URLSearchParams(params);value?next.set('kind',value):next.delete('kind');setParams(next);}}>{label}</button>)}</div>
    {query.isPending && <div className="feed-skeleton" role="status" aria-label="글을 불러오고 있어요"><span/><span/><span/></div>}
    {query.isError && <div role="alert"><p>{query.error.message}</p><button className="btn btn-ghost" disabled={query.isFetching} onClick={()=>query.isFetchNextPageError?query.fetchNextPage():query.refetch()}>다시 조회</button></div>}
    {!query.isPending && !query.isError && !rows.length && <div className="empty-state"><h3>첫 이야기를 기다리고 있어요</h3><p>{kind?'다른 글 종류도 살펴보세요.':'오늘의 운동과 작은 성취를 함께 나눠 보세요.'}</p>{context.data?.canWrite&&<Link className="btn btn-primary" to={`/feed/new${crewId?`?crew=${crewId}`:''}`}>첫 이야기 남기기</Link>}</div>}
    <div className="feed-list">{rows.map(post=><article key={post.id} className="feed-post">
      {!embedded && post.crews && <Link to={`/crews/${post.crew_id}`} className="crew-identity crew-feed-identity post-crew-context"><CrewMark name={post.crews.name} sport={post.crews.sport}/><span className="crew-type-label">크루</span><span>{post.crews.name}</span><span className="crew-context-arrow" aria-hidden="true">›</span></Link>}
      {crewId && post.is_pinned && <p className="post-pin-label">고정글</p>}
      <header className="post-card-heading"><PostAuthor authorId={post.author_id} nickname={post.profiles?.nickname || '회원'} createdAt={post.created_at} visibility={post.visibility}/><span className="post-kind">{KINDS[post.kind]} 글</span></header>
      <FeedPostLink postId={post.id} className="feed-preview">{post.content}</FeedPostLink>
      {(post.content.length>180||post.content.split('\n').length>4)&&<FeedPostLink postId={post.id} className="feed-read-more">이야기 전체 보기 ↗</FeedPostLink>}
      {post.image_path && <PostImage key={images.data?.[post.image_path] || post.image_path} url={images.data?.[post.image_path]} loading={images.isFetching} onRetry={()=>images.refetch()}/>}
      <ActivitySummary activity={post.activities}/>
      <FeedReaction post={post} summary={summaries.data?.[post.id]} onRetry={()=>summaries.refetch()}/>
    </article>)}</div>
    {query.hasNextPage && <button className="btn btn-ghost" disabled={query.isFetching} onClick={()=>query.fetchNextPage()}>글 더 보기</button>}
  </div>{!embedded&&<FeedSidebar/>}</div>;
}
