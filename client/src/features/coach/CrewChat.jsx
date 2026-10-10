import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../../shared/supabaseClient.js';
import {useAuth} from '../auth/index.js';
import './crew-chat.css';
import {markCrewRead} from './markCrewRead.js';
const result=async request=>{const {data,error}=await request;if(error)throw error;return data;};
export function useCrewRooms(){
 const {user}=useAuth();const qc=useQueryClient();
 const query=useQuery({queryKey:['crew-chat-rooms',user.id],queryFn:()=>result(supabase.rpc('crew_chat_rooms')),refetchInterval:15000,retry:false});
 useEffect(()=>{const channel=supabase.channel('crew-chat-'+user.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'crew_messages'},()=>{qc.invalidateQueries({queryKey:['crew-chat-rooms',user.id]});qc.invalidateQueries({queryKey:['crew-chat-messages',user.id]});}).subscribe();return()=>{supabase.removeChannel(channel);};},[user.id,qc]);
 return query;
}
export function CrewRoomList({query,onSelect}){
 return <div className="crew-chat-rooms"><h3>크루 대화</h3>{query.isPending?<p role="status">대화 목록을 불러오는 중…</p>:query.isError?<div role="alert"><p>크루 대화를 불러오지 못했어요.</p><button onClick={()=>query.refetch()}>다시 시도</button></div>:!query.data?.length?<p>크루에 가입하면 이곳에서 함께 이야기할 수 있어요.</p>:query.data.map(room=><button key={room.crew_id} className="crew-chat-room" onClick={()=>onSelect(room.crew_id)}><span className="crew-chat-symbol" aria-hidden="true">크루</span><span><strong>{room.name}</strong><small>{room.last_body||'첫 인사를 건네 보세요.'}</small></span>{Number(room.unread)>0&&<b aria-label={`안 읽은 메시지 ${room.unread}개`}>{Number(room.unread)>99?'99+':room.unread}</b>}</button>)}</div>;
}
export default function CrewChat({roomId,active,direct=false}){
 const {user}=useAuth(),qc=useQueryClient();const [text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[older,setOlder]=useState([]),[more,setMore]=useState(true),[loadingOlder,setLoadingOlder]=useState(false);
 const table=direct?'direct_messages':'crew_messages',root=direct?'direct-chat':'crew-chat',inputId=direct?'direct-chat-input':'crew-chat-input';
 const messageQuery=()=>{const q=supabase.from(table).select('id,seq,author_id,body,created_at,profiles!author_id(nickname)');return direct?q.or('author_id.eq.'+roomId+',recipient_id.eq.'+roomId):q.eq('crew_id',roomId);};
 const pending=useRef(null),lock=useRef(false),scroller=useRef(null),nearBottom=useRef(true),seen=useRef(0);
 const query=useQuery({queryKey:[root+'-messages',user.id,roomId],enabled:active,retry:false,refetchInterval:active?3000:false,queryFn:async()=>{
  if(direct){const blocked=await result(supabase.rpc('community_blocked',{p_other:roomId}));const peer=await result(supabase.from('profiles').select('id').eq('id',roomId).maybeSingle());if(blocked||!peer||roomId===user.id)return {allowed:false,messages:[]};}else{
  const membership=await result(supabase.from('crew_members').select('status').eq('crew_id',roomId).eq('user_id',user.id).maybeSingle());
  if(membership?.status!=='approved')return {allowed:false,messages:[]};}
  const messages=await result(messageQuery().order('seq',{ascending:false}).limit(50));
  // Recheck previously loaded history under current RLS (including new blocks).
  if(older.length){const visible=await result(messageQuery().in('id',older.map(m=>m.id)));setOlder(visible);}
  return {allowed:true,messages:messages.reverse()};
 }});
 const denied=query.data?.allowed===false;
 const messages=denied?[]:[...new Map([...older,...(query.data?.messages||[])].map(m=>[m.id,m])).values()].sort((a,b)=>a.seq-b.seq);
 const latest=messages.at(-1)?.seq;
 useEffect(()=>{if(denied){setOlder([]);setText('');qc.invalidateQueries({queryKey:[root+'-rooms',user.id]});}},[denied,qc,user.id]);
 useEffect(()=>{if(active&&nearBottom.current&&scroller.current)scroller.current.scrollTop=scroller.current.scrollHeight;},[latest,active]);
 useEffect(()=>{
  if(!active||!latest||denied||query.isError||!nearBottom.current||document.visibilityState!=='visible'||latest<=seen.current)return;
  let cancelled=false;
  markCrewRead(supabase,roomId,user.id,latest,direct).then(()=>{if(!cancelled){seen.current=latest;qc.invalidateQueries({queryKey:[root+'-rooms',user.id]});}}).catch(()=>{});
  return()=>{cancelled=true;};
 },[latest,active,denied,query.dataUpdatedAt,query.isError,roomId,user.id,qc]);
 async function send(e){e.preventDefault();if(lock.current||!text.trim()||denied)return;lock.current=true;setBusy(true);setError('');const body=text.trim();if(pending.current?.body!==body)pending.current={id:crypto.randomUUID(),body};
  try{const response=await supabase.from(table).insert({...pending.current,...(direct?{recipient_id:roomId}:{crew_id:roomId}),author_id:user.id});if(response.error){if(response.error.code!=='23505')throw response.error;const existing=await result(supabase.from(table).select('id').eq('id',pending.current.id).single());if(!existing)throw response.error;}setText('');pending.current=null;nearBottom.current=true;await query.refetch();qc.invalidateQueries({queryKey:[root+'-rooms',user.id]});}
  catch{setError(direct?'보내지 못했어요. 연결이나 차단 상태를 확인해 주세요.':'보내지 못했어요. 연결과 크루 가입 상태를 확인한 뒤 다시 보내 주세요.');}finally{lock.current=false;setBusy(false);}
 }
 async function loadOlder(){setLoadingOlder(true);setError('');const node=scroller.current,previousHeight=node?.scrollHeight||0;
  try{const rows=await result(messageQuery().lt('seq',messages[0]?.seq||0).order('seq',{ascending:false}).limit(50));setOlder(previous=>[...rows.reverse(),...previous]);setMore(rows.length===50);requestAnimationFrame(()=>{if(node)node.scrollTop+=node.scrollHeight-previousHeight;});}catch{setError('이전 메시지를 불러오지 못했어요.');}finally{setLoadingOlder(false);}
 }
 return <div className="crew-chat-thread"><div className="crew-chat-log" ref={scroller} onScroll={e=>{const n=e.currentTarget;nearBottom.current=n.scrollHeight-n.scrollTop-n.clientHeight<60;}} aria-label={direct?"개인 대화 내용":"크루 대화 내용"}>
 {query.isPending?<p role="status">대화를 불러오는 중…</p>:query.isError?<div role="alert"><p>대화를 불러오지 못했어요.</p><button onClick={()=>query.refetch()}>다시 시도</button></div>:denied?<p role="status">{direct?"차단 상태이거나 대화할 수 없는 회원이에요.":"크루 가입이 승인된 멤버만 대화할 수 있어요."}</p>:<>{messages.length>=50&&more&&<button className="chat-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder?'불러오는 중…':'이전 메시지 보기'}</button>}{!messages.length&&<div className="chat-empty"><strong>함께하는 운동, 가벼운 인사부터</strong><p>{direct?"첫 메시지로 인사를 건네 보세요.":"크루원들에게 첫 메시지를 보내 보세요."}</p></div>}{messages.map((m,i)=>{const own=m.author_id===user.id,date=new Date(m.created_at).toLocaleDateString('ko-KR'),prev=i?new Date(messages[i-1].created_at).toLocaleDateString('ko-KR'):null;return <div key={m.id}>{date!==prev&&<p className="chat-date">{date}</p>}<article className={'crew-message'+(own?' own':'')}><span className="chat-person" aria-hidden="true">{(m.profiles?.nickname||'회원').slice(0,1)}</span><div><strong>{own?'나':m.profiles?.nickname||'회원'}</strong><p>{m.body}</p><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></div></article></div>;})}</>}
 </div><form className="crew-chat-compose" onSubmit={send}><label className="sr-only" htmlFor={inputId}>{direct?"개인 메시지 보내기":"크루에 메시지 보내기"}</label><textarea id={inputId} value={text} maxLength={2000} rows={2} placeholder={direct?"메시지 보내기":"크루원들에게 메시지 보내기"} disabled={busy||denied} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(e);}}}/><div><small>{text.length}/2,000 · Shift+Enter 줄바꿈</small><button type="submit" disabled={busy||denied||!query.isSuccess||!text.trim()}>{busy?'전송 중…':'보내기'}</button></div>{error&&<p role="alert">{error}</p>}</form></div>;
}

