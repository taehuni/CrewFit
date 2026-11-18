import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';

export async function uploadPoseVideo(id,clip,token,signal){
 const response=await fetch(`${import.meta.env.VITE_API_URL||''}/api/pose/sessions/${encodeURIComponent(id)}/video`,{method:'PUT',signal,headers:{Authorization:`Bearer ${token}`,'Content-Type':clip.mimeType,'X-Video-Duration-Seconds':String(clip.durationSeconds)},body:clip.blob});
 if(!response.ok)throw new Error('영상을 보관하지 못했어요. 결과는 저장되어 있으며 다시 시도할 수 있어요.');
 return response.json();
}
export default function PoseVideo({sessionId}){
 const {user,token}=useAuth();const [video,setVideo]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[deletionPending,setDeletionPending]=useState(false);const job=useRef(null);
 useEffect(()=>{job.current?.abort();job.current=null;setBusy(false);setDeletionPending(false);setVideo(null);setMessage('');return()=>job.current?.abort();},[user?.id,sessionId]);
 async function load(remove=false){job.current?.abort();const controller=new AbortController();job.current=controller;setBusy(true);setMessage('');try{const data=await api(`/pose/sessions/${encodeURIComponent(sessionId)}/video`,{token,method:remove?'DELETE':'GET',signal:controller.signal});if(controller.signal.aborted)return;setVideo(data?.video||null);setDeletionPending(Boolean(data?.deletionPending));setMessage(data?.deletionPending?'영상 삭제를 마치지 못했어요. 삭제를 다시 시도해 주세요.':remove?'영상을 삭제했어요. 측정 결과는 유지돼요.':data?.video?'':'보관한 영상이 없거나 직접 삭제한 영상이에요.');}catch(error){if(!controller.signal.aborted)setMessage('영상을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');}finally{if(!controller.signal.aborted)setBusy(false);}}
 return <div className="pose-video-box"><button className="btn" disabled={busy} onClick={()=>load()}>{busy?'확인 중…':'보관 영상 보기'}</button><small>본인만 재생 · 직접 삭제할 때까지 보관</small>{video?.url&&<><video key={video.url} src={video.url} controls playsInline onError={()=>setMessage('재생 링크가 만료됐을 수 있어요. 보관 영상 보기를 다시 눌러 주세요.')}/><button className="btn" disabled={busy} onClick={()=>load(true)}>영상 삭제</button></>}{deletionPending&&<button className="btn" disabled={busy} onClick={()=>load(true)}>영상 삭제 다시 시도</button>}{message&&<p role="status">{message}</p>}</div>;
}
