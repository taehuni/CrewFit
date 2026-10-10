import {useState,useRef,useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../features/auth/index.js';
import {supabase} from './supabaseClient.js';
import {queryKeys} from './queryKeys.js';
import {loadMemberCard,loadCover,uploadMedia,saveResult,validatePhoto} from './community.js';
import {SPORT_LABEL,LEVEL_LABEL} from './ui.jsx';

export function MemberOverview({profile,onPhotoClick}){
 return <section className="member-overview card">{onPhotoClick?<button type="button" className="profile-avatar-button" onClick={onPhotoClick} aria-label="프로필 사진 변경"><MemberAvatar id={profile.id} name={profile.nickname} large/><span className="profile-camera" aria-hidden="true">＋</span></button>:<MemberAvatar id={profile.id} name={profile.nickname} large/>}<div><p className="member-type-label">회원 프로필</p><h2>{profile.nickname}</h2><p className="member-profile-tags"><span>{SPORT_LABEL[profile.main_sport]||'주종목 미설정'}</span>{profile.level&&<span>{LEVEL_LABEL[profile.level]}</span>}</p><MemberBio id={profile.id}/></div></section>;
}

export function MemberAvatar({id,name='회원',large=false}){
  const {user}=useAuth();const [failed,setFailed]=useState(false);
  const card=useQuery({queryKey:queryKeys.memberCard(user.id,id),queryFn:()=>loadMemberCard(supabase,id),staleTime:120000,refetchInterval:3000000,retry:false});
  useEffect(()=>setFailed(false),[card.data?.url]);
  return <span className={`member-avatar${large?' member-avatar-large':''}`} aria-hidden="true">{card.data?.url&&!failed?<img src={card.data.url} alt="" onError={()=>setFailed(true)}/>:Array.from(name)[0]}</span>;
}
export function MemberBio({id}){
  const {user}=useAuth();const card=useQuery({queryKey:queryKeys.memberCard(user.id,id),queryFn:()=>loadMemberCard(supabase,id),staleTime:120000,retry:false});
  return card.data?.bio?<p className="member-bio">{card.data.bio}</p>:null;
}
export function CrewCover({crew,compact=false}){
  const {user}=useAuth();const [failed,setFailed]=useState(false);
  const cover=useQuery({queryKey:queryKeys.crewCover(user.id,String(crew.id)),queryFn:()=>loadCover(supabase,crew.id),staleTime:120000,refetchInterval:3000000,retry:false});
  useEffect(()=>setFailed(false),[cover.data?.url]);
  return <div className={`crew-cover ${compact?'crew-cover-compact':''}`} data-sport={crew.sport} aria-hidden="true">{cover.data?.url&&!failed?<img src={cover.data.url} alt="" onError={()=>setFailed(true)}/>:<><span className="cover-orbit"/><span className="cover-word">{({running:'RUN TOGETHER',walking:'STEP BY STEP',gym:'ONE MORE SET',cycling:'KEEP RIDING',swimming:'FIND YOUR FLOW'})[crew.sport]||'MOVE TOGETHER'}</span></>}</div>;
}
export function MediaEditor({crew=null,photoInputRef=null,mode="all"}){
  const {user}=useAuth(),cache=useQueryClient(),lock=useRef(false),localInput=useRef(null);
  const inputRef=photoInputRef||localInput;
  const key=crew?queryKeys.crewCover(user.id,String(crew.id)):queryKeys.memberCard(user.id,user.id);
  const query=useQuery({queryKey:key,queryFn:()=>crew?loadCover(supabase,crew.id):loadMemberCard(supabase,user.id),retry:false});
  const [photo,setPhoto]=useState(null),[preview,setPreview]=useState(''),[bio,setBio]=useState(null),[remove,setRemove]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{if(!photo){setPreview('');return;}const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url);},[photo]);
  async function submit(e){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');let uploaded;
    try{
      if(photo)uploaded=await uploadMedia(supabase,user.id,photo);
      const path=uploaded || (remove?null:crew?query.data?.image_path:query.data?.avatar_path) || null;
      if(crew){if(path)await saveResult(query.data?supabase.from('crew_covers').update({image_path:path}).eq('crew_id',crew.id):supabase.from('crew_covers').insert({crew_id:crew.id,image_path:path}));else await saveResult(supabase.from('crew_covers').delete().eq('crew_id',crew.id));}
      else {const row=mode==='bio'?{bio:(bio??query.data?.bio??'').trim()}:mode==='photo'?{avatar_path:path}:{avatar_path:path,bio:(bio??query.data?.bio??'').trim()};await saveResult(query.data?supabase.from('member_cards').update(row).eq('user_id',user.id):supabase.from('member_cards').insert({user_id:user.id,...row}));}
      const previous=crew?query.data?.image_path:query.data?.avatar_path;
      if(mode!=="bio" && previous && previous!==path){
        const [cards,covers]=await Promise.all([supabase.from('member_cards').select('user_id').eq('avatar_path',previous).limit(1),supabase.from('crew_covers').select('crew_id').eq('image_path',previous).limit(1)]);
        if(!cards.error&&!covers.error&&!cards.data.length&&!covers.data.length)await supabase.storage.from('community-media').remove([previous]);
      }
      setPhoto(null);setRemove(false);await cache.invalidateQueries({queryKey:['community',user.id]});setMessage('저장했어요.');
    }catch(e){if(uploaded)await supabase.storage.from('community-media').remove([uploaded]);setError(e.message);}finally{lock.current=false;setBusy(false);}
  }
  return <section className={mode==="photo"?"media-editor profile-photo-controls":"card media-editor"}>{mode!=="photo"&&<><h2>{crew?'크루 대표 사진':mode==='bio'?'자기소개':'사진과 자기소개'}</h2><p className="muted">{crew?'크루의 분위기를 보여주는 사진을 골라 주세요.':'다른 회원에게 나를 소개해 보세요.'}</p></>}
    <form onSubmit={submit}><fieldset disabled={busy||query.isPending||query.isError}>
      {crew&&(preview || (!remove&&query.data?.url))&&<img className={crew?'media-preview':'media-preview avatar-preview'} src={preview||query.data.url} alt="선택한 사진 미리보기"/>}
      {!crew&&mode==="all"&&<button type="button" className="profile-photo-picker" aria-label="프로필 사진 선택" onClick={()=>inputRef.current?.click()}>{(preview||(!remove&&query.data?.url))?<img src={preview||query.data.url} alt="프로필 사진 미리보기"/>:<span className="profile-photo-placeholder" aria-hidden="true">＋</span>}<span className="profile-photo-caption">{preview?"선택한 사진 · 저장 전":"눌러서 사진 변경"}</span></button>}
      {mode!=="bio"&&<label className={crew?"photo-picker":"profile-file-input"}>사진 선택<input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)try{validatePhoto(f);setPhoto(f);setRemove(false);setError('');}catch(err){setError(err.message);}e.target.value='';}}/></label>}
      {mode!=="bio"&&(photo||query.data?.url)&&<button type="button" className="btn btn-ghost" onClick={()=>{setPhoto(null);setRemove(true);}}>사진 없애기</button>}
      {!crew&&mode!=="photo"&&<label>짧은 자기소개<textarea rows={3} maxLength={160} value={bio??query.data?.bio??''} placeholder="천천히, 꾸준히 달리는 것을 좋아해요." onChange={e=>setBio(e.target.value)}/></label>}
      {mode!=="bio"&&<small className="muted">JPG·PNG·WebP · 최대 20MB · 사진은 자동으로 크기를 줄여 저장해요.</small>}
      {mode==="photo"&&preview&&<img className="media-preview avatar-preview" src={preview} alt="저장할 프로필 사진 미리보기"/>}{(mode!=="photo"||photo||remove)&&<button className="btn btn-primary" disabled={busy}>{busy?'저장 중…':'저장하기'}</button>}
    </fieldset></form>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{query.isError&&<button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 불러오기</button>}
  </section>;
}


