import {useRef,useState,useEffect} from 'react';
import {useNavigate,useLocation} from 'react-router';
import './chat-dock.css';
import CrewChat,{useCrewRooms,CrewRoomList} from './CrewChat.jsx';
import {useDirectRooms,DirectRoomList,NewDirectChat} from './DirectChats.jsx';
export default function ChatDock(){
 const navigate=useNavigate();const {pathname,search}=useLocation();const [open,setOpen]=useState(false),[view,setView]=useState('list'),[expanded,setExpanded]=useState(false);
 const launcher=useRef(null),heading=useRef(null);
 const rooms=useCrewRooms();const [roomId,setRoomId]=useState(null);const room=rooms.data?.find(r=>r.crew_id===roomId);const directs=useDirectRooms();const [peer,setPeer]=useState(null);const unread=(directs.data||[]).reduce((sum,r)=>sum+Number(r.unread),0)+(rooms.data||[]).reduce((sum,r)=>sum+Number(r.unread),0);
 function selectPeer(profile){setPeer(profile);setView('direct');setOpen(true);requestAnimationFrame(()=>heading.current?.focus());}
 useEffect(()=>{const handler=()=>{setOpen(false);navigate('/coach');};window.addEventListener('crewfit:coach-chat',handler);return()=>window.removeEventListener('crewfit:coach-chat',handler);},[navigate]);
 useEffect(()=>{const handler=e=>{if(e.detail?.id)selectPeer(e.detail);};window.addEventListener('crewfit:direct-chat',handler);return()=>window.removeEventListener('crewfit:direct-chat',handler);},[]);
 useEffect(()=>{if(new URLSearchParams(search).has('calendar'))setOpen(false);if(new URLSearchParams(search).get('coach')==='plans'){setOpen(false);navigate('/coach?view=plans');}},[search,navigate]);
 useEffect(()=>{if(pathname.startsWith('/meals/')||pathname==='/store')setOpen(false);},[pathname]);
 function close(){setOpen(false);launcher.current?.focus();}
 function show(){setOpen(true);requestAnimationFrame(()=>heading.current?.focus());}

 return <div className="chat-dock" data-open={open}><section id="crewfit-chat-panel" className={`chat-dock-panel ${expanded?'chat-expanded':''}`} role="dialog" aria-modal="false" aria-labelledby="chat-panel-title" hidden={!open} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}if(e.key==='Tab'&&window.matchMedia('(max-width:959px)').matches){const items=[...e.currentTarget.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled)')].filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===heading.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
 <header className="chat-dock-header">{view!=='list'&&<button type="button" aria-label="대화 목록으로" onClick={()=>setView('list')}>←</button>}<div><h2 id="chat-panel-title" ref={heading} tabIndex={-1}>{view==='list'?'메시지':view==='crew'?(room?.name||'크루 대화'):view==='direct'?(peer?.nickname||'회원'):view==='new'?'새 대화':'AI 코치'}</h2><p>{view==='list'?'운동을 이어가는 대화':view==='crew'?'크루 멤버 전용 대화':view==='direct'?'회원 · 1:1 대화':view==='new'?'운동 메이트에게 인사해 보세요':'나의 기록으로 함께 세우는 계획'}</p></div><button type="button" className="chat-expand" aria-label={expanded?'패널로 줄이기':'메시지 크게 보기'} onClick={()=>setExpanded(!expanded)}>⤢</button><button type="button" aria-label="채팅 접기" onClick={close}>−</button></header>
 <div className="chat-dock-list" hidden={view!=='list'}><div className="chat-list-toolbar"><span className="chat-list-label">내 대화</span><button onClick={()=>setView("new")}>＋ 새 대화</button></div><DirectRoomList query={directs} onSelect={selectPeer}/><CrewRoomList query={rooms} onSelect={id=>{setRoomId(id);setView("crew");}}/></div>
 {view==="new"&&<NewDirectChat onSelect={selectPeer}/>} {peer&&<div className="crew-chat-thread" hidden={view!=="direct"}><CrewChat key={peer.id} roomId={peer.id} direct active={open&&view==="direct"}/></div>} {roomId&&<div className="crew-chat-thread" hidden={view!=="crew"}><CrewChat key={roomId} roomId={roomId} active={open&&view==="crew"}/></div>}</section><button ref={launcher} type="button" className="chat-dock-launcher" aria-label="메시지" aria-expanded={open} aria-controls="crewfit-chat-panel" onClick={()=>open?close():show()}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-4 3 2-7a8 8 0 1 1 17-4Z"/><path d="M7 10h10M7 14h6"/></svg><span>{open?'채팅 접기':'메시지'}</span>{unread>0?<b className="chat-unread" aria-label="안 읽은 메시지">{unread>99?"99+":unread}</b>:null}</button></div>;
}




