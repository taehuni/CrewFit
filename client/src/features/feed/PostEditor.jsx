import { useEffect,useRef,useState } from 'react';
import { Link,useNavigate,useParams,useSearchParams,useLocation } from 'react-router';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS } from '../crews/crews.js';
import { KINDS,feedUrl,feedContext,loadPost,savePost,postInput } from './posts.js';
import { uploadPostImage } from './postImages.js';
import {preparePhoto,validatePhoto} from '../../shared/community.js';
import StoredPostImage from './PostImage.jsx';
import { ActivityPicker } from './ActivityAttachment.jsx';
import './feed.css';

export default function PostEditor(){
  const {user}=useAuth(),{postId}=useParams(),[params]=useSearchParams();
  const query=useQuery({queryKey:queryKeys.post(user.id,postId || 'new'),queryFn:()=>loadPost(supabase,postId),enabled:!!postId,retry:false,gcTime:0});
  const crewId=postId ? query.data?.crew_id : params.get('crew');
  const context=useQuery({queryKey:queryKeys.feedContext(user.id,crewId?String(crewId):null),queryFn:()=>feedContext(supabase,crewId?String(crewId):null),enabled:!postId || !!query.data,retry:false,staleTime:0});
  if(postId && query.isPending)return <p role="status">작성 화면을 불러오고 있어요.</p>;
  if(query.isError || context.isError)return <div role="alert"><p>작성 화면을 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={()=>{if(postId)query.refetch();context.refetch();}}>다시 조회</button></div>;
  if(postId && (!query.data || query.data.author_id!==user.id || !Object.hasOwn(KINDS,query.data.kind)))return <p>글이 없거나 수정할 수 없어요. <Link to="/feed">피드로</Link></p>;
  if(context.isPending)return <p role="status">작성 권한을 확인하고 있어요.</p>;
  if(!postId && !context.data?.canWrite)return <p>크루 글 작성 권한이 없어요. <Link to={feedUrl(crewId)}>피드로</Link></p>;
  return <EditorForm key={postId || `new:${crewId}`} userId={user.id} crewId={crewId} crew={context.data?.crew} existing={query.data} />;
}
function EditorForm({userId,crewId,crew,existing}){
  const location=useLocation();
  const from=location.state?.feedFrom;
  const feedBack=typeof from==='string'&&/^\/(crews\/[1-9]\d*|feed)(\?[^#]*)?$/.test(from)?from:crewId?`/crews/${crewId}`:'/feed';
  const [includeRoute,setIncludeRoute]=useState(existing?.include_route===true);
  const [activityId,setActivityId]=useState(existing?.activity_id?String(existing.activity_id):null);
  const [form,setForm]=useState({content:existing?.content || '',kind:existing?.kind || 'free',visibility:existing?.visibility || (crewId?'crew':'public'),sport:existing?.sport || crew?.sport || ''});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const running=useRef(false),cache=useQueryClient(),navigate=useNavigate();
  const [photo,setPhoto]=useState(null),[preview,setPreview]=useState(''),[removed,setRemoved]=useState(false);
  const uploaded=useRef(null),fileInput=useRef(null);
  useEffect(()=>{if(!photo){setPreview('');return;}const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url);},[photo]);
  function choosePhoto(event){const file=event.target.files?.[0];if(!file)return;
    try{validatePhoto(file);setPhoto(file);setRemoved(false);uploaded.current=null;setError('');}
    catch(cause){setError(cause.message);}event.target.value='';}
  const change=event=>setForm(previous=>({...previous,[event.target.name]:event.target.value}));
  async function submit(event){event.preventDefault();if(running.current)return;running.current=true;setBusy(true);setError('');
    try{
      postInput(form,crewId);
      let imagePath=removed?null:undefined;
      if(photo){
        if(!uploaded.current)uploaded.current=await uploadPostImage(supabase,userId,await preparePhoto(photo));
        imagePath=uploaded.current;
      }
      const post=await savePost(supabase,userId,form,crewId,existing,imagePath,activityId,includeRoute);await cache.invalidateQueries({queryKey:queryKeys.postsRoot(userId)});navigate(`/feed/${post.id}`,{replace:true,state:{feedFrom:location.state?.feedFrom}});}
    catch(cause){setError(cause.message);}finally{running.current=false;setBusy(false);}}
  return <div className="feed-page"><header className="feed-heading"><h1>{existing?'글 수정':'글 쓰기'}</h1><Link to={existing?`/feed/${existing.id}`:feedBack} state={existing?{feedFrom:feedBack}:{restoreFeed:true}}>취소</Link></header>
    <form className="post-form" onSubmit={submit}><fieldset disabled={busy}>
      {crew && <p>{crew.name} · 크루는 작성 후 바꿀 수 없어요.</p>}
      <label>오늘 운동은 어땠나요?<textarea placeholder="함께 나누고 싶은 오늘의 운동 이야기를 적어 주세요." name="content" required maxLength={5000} rows={6} value={form.content} onChange={change}/></label><small>{form.content.length.toLocaleString()} / 5,000자</small>
      <div className="post-photo-editor"><label>사진 1장 · 선택<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto}/></label>
        <p className="feed-note">JPG·PNG·WebP · 최대 20MB. 사진 크기를 줄이고 위치 메타데이터를 제거해 저장해요.</p>
        {preview?<img className="post-image" src={preview} alt="첨부할 사진 미리보기"/>:!photo && !removed && existing?.image_path?<StoredPostImage path={existing.image_path}/>:null}
        {(photo || (!removed && existing?.image_path)) && <button type="button" className="btn btn-ghost" onClick={()=>{setPhoto(null);setRemoved(true);uploaded.current=null;if(fileInput.current)fileInput.current.value='';}}>사진 제거</button>}
        {removed && existing?.image_path && <><p className="feed-note">수정 저장 시 사진 첨부가 해제됩니다.</p><button type="button" className="btn btn-ghost" onClick={()=>setRemoved(false)}>기존 사진 유지</button></>}
      </div>
      <details className="post-options"><summary>공개 범위 · 운동 기록 · 추가 설정</summary><div>
      <label>글 종류<select name="kind" value={form.kind} onChange={change}>{Object.entries(KINDS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>공개 범위<select name="visibility" value={form.visibility} onChange={change}><option value="public">전체 공개 · 로그인한 모든 회원</option>{crewId && <option value="crew">크루 전용 · 승인된 크루원</option>}</select></label>
      {crewId && form.visibility==='public' && <p className="feed-note">크루 밖 회원도 전체 피드에서 이 글을 볼 수 있어요.</p>}
      <ActivityPicker value={activityId} disabled={busy} onChange={activity=>{setIncludeRoute(false);setActivityId(activity?String(activity.id):null);if(activity)setForm(previous=>({...previous,kind:'log',sport:activity.sport}));}}/>
      {activityId && <label><input type="checkbox" checked={includeRoute} onChange={event=>setIncludeRoute(event.target.checked)}/>GPS 경로도 공유하기</label>}
      {includeRoute && <p className="feed-note" role="status">{form.visibility==='public'?'전체 공개 글이므로 크루 밖 회원도 경로와 출발·도착 위치를 볼 수 있어요.':'승인된 크루원이 경로와 출발·도착 위치를 볼 수 있어요.'} GPS로 측정한 기록만 경로를 첨부할 수 있어요.</p>}
      <label>종목 · 선택<select name="sport" value={form.sport} disabled={!!activityId} onChange={change}><option value="">선택 안 함</option>{Object.entries(SPORTS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>

      </div></details>
      {error && <p role="alert" className="feed-error">{error}</p>}
      <button className="btn btn-primary" type="submit">{busy?'저장 중…':existing?'수정 저장':'게시하기'}</button>
    </fieldset></form></div>;
}
