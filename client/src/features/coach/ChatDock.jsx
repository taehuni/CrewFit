import {lazy,Suspense,useRef,useState,useEffect} from 'react';
import {useLocation} from 'react-router';
import './chat-dock.css';
import CrewChat,{useCrewRooms,CrewRoomList} from './CrewChat.jsx';
import {useDirectRooms,DirectRoomList,NewDirectChat} from './DirectChats.jsx';
const CoachPage=lazy(()=>import('./CoachPage.jsx'));
export default function ChatDock(){
 const {pathname,search}=useLocation();const [open,setOpen]=useState(false),[view,setView]=useState('list'),[visited,setVisited]=useState(false);
 const launcher=useRef(null),heading=useRef(null);
 const rooms=useCrewRooms();const [roomId,setRoomId]=useState(null);const room=rooms.data?.find(r=>r.crew_id===roomId);const directs=useDirectRooms();const [peer,setPeer]=useState(null);const unread=(directs.data||[]).reduce((sum,r)=>sum+Number(r.unread),0)+(rooms.data||[]).reduce((sum,r)=>sum+Number(r.unread),0);
 function selectPeer(profile){setPeer(profile);setView('direct');setOpen(true);requestAnimationFrame(()=>heading.current?.focus());}
 useEffect(()=>{const handler=e=>{if(e.detail?.id)selectPeer(e.detail);};window.addEventListener('crewfit:direct-chat',handler);return()=>window.removeEventListener('crewfit:direct-chat',handler);},[]);
 useEffect(()=>{if(new URLSearchParams(search).has('calendar'))setOpen(false);if(new URLSearchParams(search).get('coach')==='plans'){setVisited(true);setView('plans');setOpen(true);}},[search]);
 useEffect(()=>{if(pathname.startsWith('/meals/')||pathname==='/store')setOpen(false);},[pathname]);
 function close(){setOpen(false);launcher.current?.focus();}
 function show(){setOpen(true);requestAnimationFrame(()=>heading.current?.focus());}
 if(pathname==='/coach')return null;
 return <div className="chat-dock"><section id="crewfit-chat-panel" className="chat-dock-panel" role="dialog" aria-modal="false" aria-labelledby="chat-panel-title" hidden={!open} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
 <header className="chat-dock-header">{view!=='list'&&<button type="button" aria-label="대화 목록으로" onClick={()=>setView('list')}>←</button>}<div><h2 id="chat-panel-title" ref={heading} tabIndex={-1}>{view==='list'?'메시지':view==='crew'?(room?.name||'크루 대화'):view==='direct'?(peer?.nickname||'회원'):view==='new'?'새 대화':'AI 코치'}</h2><p>{view==='list'?'운동을 이어가는 대화':view==='crew'?'크루 멤버 전용 대화':view==='direct'?'회원 · 1:1 대화':view==='new'?'운동 메이트에게 인사해 보세요':'나의 기록으로 함께 세우는 계획'}</p></div><button type="button" aria-label="채팅 접기" onClick={close}>−</button></header>
 <div className="chat-dock-list" hidden={view!=='list'}><div className="chat-list-toolbar"><span className="chat-list-label">내 대화</span><button onClick={()=>setView("new")}>＋ 새 대화</button></div><button className="chat-coach-row" onClick={()=>{setVisited(true);setView('coach');}}><span className="chat-ai-avatar">AI</span><span><strong>AI 코치 <small>나만의 코치</small></strong><span>운동 이야기부터 다음 계획까지</span></span><span aria-hidden="true">›</span></button><DirectRoomList query={directs} onSelect={selectPeer}/><CrewRoomList query={rooms} onSelect={id=>{setRoomId(id);setView("crew");}}/></div>
 <div className="chat-dock-thread" hidden={view!=='coach'&&view!=='plans'}><nav className="chat-dock-tabs" aria-label="AI 코치 화면"><button aria-pressed={view==='coach'} onClick={()=>setView('coach')}>대화</button><button aria-pressed={view==='plans'} onClick={()=>setView('plans')}>저장한 계획</button></nav><div className={`chat-dock-body ${view==='plans'?'show-plans':'show-conversation'}`}>{visited&&<Suspense fallback={<p role="status">코치를 불러오는 중…</p>}><CoachPage/></Suspense>}</div></div>
 {view==="new"&&<NewDirectChat onSelect={selectPeer}/>} {peer&&<div className="crew-chat-thread" hidden={view!=="direct"}><CrewChat key={peer.id} roomId={peer.id} direct active={open&&view==="direct"}/></div>} {roomId&&<div className="crew-chat-thread" hidden={view!=="crew"}><CrewChat key={roomId} roomId={roomId} active={open&&view==="crew"}/></div>}</section><button ref={launcher} type="button" className="chat-dock-launcher" aria-expanded={open} aria-controls="crewfit-chat-panel" onClick={()=>open?close():show()}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-4 3 2-7a8 8 0 1 1 17-4Z"/><path d="M7 10h10M7 14h6"/></svg><span>{open?'채팅 접기':'메시지'}</span>{unread>0?<b className="chat-unread" aria-label="안 읽은 메시지">{unread>99?"99+":unread}</b>:!open&&<small>AI 코치</small>}</button></div>;
}




