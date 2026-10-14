import './profile-polish.css';
import {useState} from 'react';
import {Link} from 'react-router';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {supabase} from '../../shared/supabaseClient.js';
import {MemberAvatar} from '../../shared/CommunityMedia.jsx';
import {openDirectChat} from '../../shared/openDirectChat.js';

export function FollowList({memberId,kind='following',onSelect}) {
 const {user}=useAuth(),[limit,setLimit]=useState(20);
 const following=kind==='following',field=following?'following_id':'follower_id';
 const q=useQuery({queryKey:['follows',user.id,memberId,kind,limit],retry:false,queryFn:async()=>{
  const {data,error}=await supabase.from('member_follows').select(`profile:profiles!member_follows_${field}_fkey(id,nickname)`).eq(following?'follower_id':'following_id',memberId).order(field).limit(limit+1);
  if(error)throw error;return data;
 }});
 return <div className="follow-list">{q.isPending?<p role="status">불러오는 중…</p>:q.isError?<p role="alert">목록을 불러오지 못했어요. <button onClick={()=>q.refetch()}>다시 시도</button></p>:!q.data?.length?<p className="muted">아직 {following?'팔로우한':'팔로워인'} 회원이 없어요.</p>:q.data.slice(0,limit).filter(r=>r.profile).map(({profile})=><div className="follow-person" key={profile.id}><Link to={`/users/${profile.id}`}><MemberAvatar id={profile.id} name={profile.nickname}/><strong>{profile.nickname}</strong></Link>{profile.id!==user.id&&<button className="btn btn-ghost" onClick={()=>onSelect?onSelect(profile):openDirectChat(profile)}>메시지</button>}</div>)}{q.data?.length>limit&&<button className="btn btn-ghost" onClick={()=>setLimit(n=>n+20)}>더 보기</button>}</div>;
}
export default function Follows({memberId}) {
 const {user}=useAuth(),cache=useQueryClient(),[list,setList]=useState(null);
 const q=useQuery({queryKey:['follows',user.id,memberId,'summary'],retry:false,queryFn:async()=>{
  const results=await Promise.all([
   supabase.from('member_follows').select('*',{count:'exact',head:true}).eq('following_id',memberId),
   supabase.from('member_follows').select('*',{count:'exact',head:true}).eq('follower_id',memberId),
   supabase.from('member_follows').select('following_id').eq('follower_id',user.id).eq('following_id',memberId).maybeSingle(),
   supabase.rpc('community_blocked',{p_other:memberId})
  ]);if(results.some(r=>r.error))throw new Error('팔로우 정보를 불러오지 못했어요.');
  return {followers:results[0].count,following:results[1].count,followed:!!results[2].data,blocked:results[3].data};
 }});
 const change=useMutation({mutationFn:async()=>{const r=q.data.followed?await supabase.from('member_follows').delete().eq('follower_id',user.id).eq('following_id',memberId):await supabase.from('member_follows').insert({follower_id:user.id,following_id:memberId});if(r.error&&r.error.code!=='23505')throw new Error('팔로우 변경을 저장하지 못했어요.');},onSuccess:()=>cache.invalidateQueries({queryKey:['follows',user.id]})});
 return <section className="profile-follows" aria-label="팔로우">{q.isError?<p role="alert">팔로우 정보를 불러오지 못했어요. <button onClick={()=>q.refetch()}>다시 시도</button></p>:<><div className="follow-counts"><button disabled={!q.data} aria-expanded={list==='followers'} onClick={()=>setList(list==='followers'?null:'followers')}>팔로워 <strong>{q.data?.followers??'—'}</strong></button><button disabled={!q.data} aria-expanded={list==='following'} onClick={()=>setList(list==='following'?null:'following')}>팔로잉 <strong>{q.data?.following??'—'}</strong></button></div>{memberId!==user.id&&<button className={`btn ${q.data?.followed?'btn-ghost':'btn-primary'}`} disabled={!q.data||q.data.blocked||change.isPending} onClick={()=>change.mutate()}>{q.data?.blocked?'차단된 회원':change.isPending?'저장 중…':q.data?.followed?'팔로잉 취소':'팔로우'}</button>}</>}{change.isError&&<p role="alert">{change.error.message}</p>}{list&&<div className="follow-expanded"><h3>{list==='followers'?'팔로워':'팔로잉'}</h3><FollowList key={memberId+list} memberId={memberId} kind={list}/></div>}</section>;
}
