import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../../shared/supabaseClient.js';
import {useAuth} from '../auth/index.js';
const result=async request=>{const {data,error}=await request;if(error)throw error;return data;};
export function useDirectRooms(){
 const {user}=useAuth(),qc=useQueryClient();
 const query=useQuery({queryKey:['direct-chat-rooms',user.id],queryFn:()=>result(supabase.rpc('direct_chat_rooms')),retry:false,refetchInterval:15000});
 useEffect(()=>{const channel=supabase.channel('direct-chat-'+user.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages'},()=>{qc.invalidateQueries({queryKey:['direct-chat-rooms',user.id]});qc.invalidateQueries({queryKey:['direct-chat-messages',user.id]});}).subscribe();return()=>{supabase.removeChannel(channel);};},[user.id,qc]);
 return query;
}
export function DirectRoomList({query,onSelect}){
 return <div className="crew-chat-rooms"><h3>개인 대화</h3>{query.isPending?<p role="status">불러오는 중…</p>:query.isError?<div role="alert"><p>개인 대화를 불러오지 못했어요.</p><button onClick={()=>query.refetch()}>다시 시도</button></div>:!query.data?.length?<p>새 대화에서 운동 메이트를 찾아보세요.</p>:query.data.map(room=><button className="crew-chat-room" key={room.peer_id} onClick={()=>onSelect({id:room.peer_id,nickname:room.nickname})}><span className="chat-person" aria-hidden="true">{room.nickname?.slice(0,1)||'회'}</span><span><strong>{room.nickname||'회원'} <small>회원</small></strong><small>{room.last_body}</small></span>{Number(room.unread)>0&&<b aria-label={`안 읽은 메시지 ${room.unread}개`}>{Number(room.unread)>99?'99+':room.unread}</b>}</button>)}</div>;
}
export function NewDirectChat({onSelect}){
 const {user}=useAuth();const [input,setInput]=useState(''),[term,setTerm]=useState('');
 const query=useQuery({queryKey:['chat-member-search',user.id,term],enabled:term.length>=2,retry:false,queryFn:()=>result(supabase.from('profiles').select('id,nickname').neq('id',user.id).ilike('nickname','%'+term.replace(/[\\%_]/g,'\\$&')+'%').order('nickname').limit(20))});
 return <div className="chat-dock-list"><form className="direct-search" onSubmit={e=>{e.preventDefault();setTerm(input.trim());}}><label htmlFor="direct-search">닉네임으로 회원 찾기</label><div><input id="direct-search" value={input} maxLength={40} onChange={e=>setInput(e.target.value)} placeholder="닉네임 2자 이상"/><button disabled={input.trim().length<2}>검색</button></div></form><p className="muted small">상대를 확인하고 대화를 시작하세요. 차단 관계에서는 메시지를 보낼 수 없어요.</p>{term.length>=2&&(query.isPending?<p role="status">검색 중…</p>:query.isError?<div role="alert">검색하지 못했어요. <button onClick={()=>query.refetch()}>다시 시도</button></div>:!query.data?.length?<p>검색된 회원이 없어요.</p>:query.data.map(profile=><button className="crew-chat-room" key={profile.id} onClick={()=>onSelect(profile)}><span className="chat-person" aria-hidden="true">{profile.nickname?.slice(0,1)}</span><span><strong>{profile.nickname}</strong><small>회원 · 대화 시작하기</small></span><span aria-hidden="true">›</span></button>))}</div>;
}
