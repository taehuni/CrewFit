import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {GYM_EXERCISE_CRITERIA} from './gymCriteria.js';
import {EXERCISE_GUIDES} from './exerciseGuides.js';
import {capturePoseFrames} from './poseAiCapture.js';
import {createVisionGate,visionCriteria} from './poseVision.js';
import {createPoseVideoRecorder} from './poseVideoRecorder.js';
import {waitForPoseCountdown} from './poseCountdown.js';
import {buildPoseSession,savePoseSession,poseToday} from './poseSessions.js';
import PoseVideo,{uploadPoseVideo} from './PoseVideo.jsx';
import {api} from '../../shared/api.js';
import useLeaveGuard from '../../shared/useLeaveGuard.jsx';

export default function PoseVisionMeasurement(){
 const {user,token}=useAuth(),queryClient=useQueryClient(),location=useLocation();
 const initial=new URLSearchParams(location.search).get('exercise')||'';
 const [selected,setSelected]=useState(visionCriteria(initial)?initial:''),[search,setSearch]=useState(''),[other,setOther]=useState('');
 const [consent,setConsent]=useState(false),[recordConsent,setRecordConsent]=useState(false),[status,setStatus]=useState('idle'),[countdown,setCountdown]=useState(null),[message,setMessage]=useState(''),[items,setItems]=useState([]),[busy,setBusy]=useState(false),[paused,setPaused]=useState(false),[seconds,setSeconds]=useState(0),[clip,setClip]=useState(null),[recordStatus,setRecordStatus]=useState(''),[result,setResult]=useState(null),[saved,setSaved]=useState(false),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false);
 const video=useRef(null),run=useRef(null),prepare=useRef(null),mounted=useRef(true),upload=useRef(null),saveLock=useRef(false),recordingId=useRef(null);
 const criterion=visionCriteria(selected),custom=selected==='other',label=criterion?.label||other.trim();
 const active=['loading','ready','countdown','running'].includes(status);
 const guard=useLeaveGuard(active||Boolean(result&&!saved)||Boolean(clip),'화면을 나가면 카메라가 꺼지고 보관하지 않은 결과와 영상은 사라져요. 나갈까요?');
 function cleanup(){prepare.current?.abort();prepare.current=null;const current=run.current;run.current=null;if(current){clearInterval(current.timer);current.job?.abort();current.recorder?.dispose();current.stream?.getTracks().forEach(track=>track.stop());}if(video.current)video.current.srcObject=null;}
 useEffect(()=>{mounted.current=true;const hide=()=>{if(document.hidden&&run.current)finish();};document.addEventListener('visibilitychange',hide);return()=>{mounted.current=false;document.removeEventListener('visibilitychange',hide);upload.current?.abort();cleanup();};},[]);
 async function openCamera(){
  if(!label||(!criterion&&!custom))return;
  if((result&&!saved||clip)&&!window.confirm('보관하지 않은 결과 또는 영상이 있어요. 지우고 새로 시작할까요?'))return;
  cleanup();setResult(null);setSaved(false);setClip(null);setRecordStatus('');setItems([]);setMessage('');setSeconds(0);setStatus('loading');setConsent(false);setRecordConsent(false);
  const current={id:crypto.randomUUID(),owner:user.id,criterion, label,items:[],gate:createVisionGate(),stream:null,started:null};run.current=current;recordingId.current=current.id;
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:640}}});if(!mounted.current||run.current!==current){stream.getTracks().forEach(track=>track.stop());return;}current.stream=stream;video.current.srcObject=stream;await video.current.play();if(run.current!==current)return;stream.getVideoTracks().forEach(track=>track.onended=()=>{if(run.current===current)finish();});setStatus('ready');}
  catch{if(run.current!==current)return;cleanup();setStatus('idle');setMessage('카메라를 켜지 못했어요. 카메라 권한과 보안 연결을 확인한 뒤 다시 시도해 주세요.');}
 }
 async function observe(current){
  if(run.current!==current||!current.started||!current.criterion||document.hidden||!current.gate.begin())return;
  const job=new AbortController();current.job=job;setBusy(true);let frames=[];const timeout=setTimeout(()=>job.abort(),30000);
  const valid=()=>mounted.current&&run.current===current&&!job.signal.aborted;
  try{frames=await capturePoseFrames(video.current,{signal:job.signal});if(!valid())return;const response=await api('/pose/feedback',{token,body:{consent:true,frames,exercise:current.criterion.id},signal:job.signal});if(!valid())return;
   if(response?.exercise!==current.criterion.id||!Array.isArray(response.observations))throw new Error('관찰 결과를 확인하지 못했어요.');
   const observations=response.observations.filter(item=>typeof item.key==='string'&&['confirmed','improve','uncertain'].includes(item.status)&&typeof item.label==='string'&&typeof item.message==='string').slice(0,2);
   current.items=observations.map(item=>({...item,source_id:current.criterion.id}));setItems(current.items);setMessage(response.reason||'화면에서 확인할 수 있는 움직임만 관찰했어요.');
   if(!response.matched){current.gate.pause();setPaused(true);setMessage('선택한 운동과 화면의 동작이 일치하는지 확인하지 못했어요. 자동 관찰을 멈췄어요. 자세를 조정한 뒤 다시 확인해 주세요.');}
  }catch(error){if(mounted.current&&run.current===current){current.gate.pause();setPaused(true);setMessage(error.name==='AbortError'?'관찰 시간이 길어져 자동 관찰을 멈췄어요. 카메라와 시간 기록은 계속돼요.':`${error.message||'관찰하지 못했어요.'} 자동 관찰은 멈췄지만 카메라와 시간 기록은 계속돼요.`);}}
  finally{clearTimeout(timeout);frames.length=0;current.gate.end();if(current.job===job)current.job=null;if(mounted.current&&run.current===current)setBusy(false);}
 }
 async function begin(){
  const current=run.current;if(!current||status!=='ready'||current.criterion&&!consent)return;
  const job=new AbortController();prepare.current=job;setStatus('countdown');
  try{await waitForPoseCountdown({signal:job.signal,onTick:setCountdown});}catch{return;}
  if(run.current!==current||job.signal.aborted||document.hidden)return;prepare.current=null;setCountdown(null);current.started=Date.now();setStatus('running');setPaused(false);setMessage(current.criterion?'천천히 동작을 보여 주세요. 화면에서 확인할 수 있는 항목을 관찰해요.':'이 운동은 자세를 평가하지 않고 운동명과 시간만 남겨요.');
  if(recordConsent){try{current.recorder=createPoseVideoRecorder({stream:current.stream,onStatus:value=>{if(mounted.current&&run.current===current)setRecordStatus(value);},onComplete:value=>{if(mounted.current&&recordingId.current===current.id)setClip({...value,id:current.id});},onError:error=>{if(mounted.current)setRecordStatus(error.message);}});}catch(error){setRecordStatus(error.message);}}
  setConsent(false);setRecordConsent(false);
  current.timer=setInterval(()=>{if(run.current!==current)return;setSeconds(Math.floor((Date.now()-current.started)/1000));void observe(current);},1000);
  void observe(current);
 }
 function chooseAgain(){if(saving||uploading)return;if((result&&!saved||clip)&&!window.confirm('보관하지 않은 결과 또는 영상이 있어요. 지우고 다른 운동을 선택할까요?'))return;cleanup();recordingId.current=null;setResult(null);setClip(null);setSaved(false);setItems([]);setMessage('');setStatus('idle');}
 function finish(){
  const current=run.current;if(!current)return;
  const recorder=current.recorder;current.recorder=null;recorder?.stop();
  if(current.started){const duration=Math.max(1,Math.min(86400,Math.round((Date.now()-current.started)/1000)));try{setResult(buildPoseSession({id:current.id,measured_on:poseToday(),exercise:current.criterion?.id||'manual_other',view:current.criterion?'auto':'manual',exercise_label:current.criterion?null:current.label,reps:null,duration_seconds:duration,observations:current.items.map(({key,label,message,source_id})=>({key,label,message,source_id}))}));setSeconds(duration);}catch{setMessage('측정 요약을 만들지 못했어요. 결과 저장 형식을 확인해 주세요.');}}
  cleanup();setCountdown(null);setBusy(false);setStatus(current.started?'ended':'idle');
 }
 async function save(){if(!result||saveLock.current)return;saveLock.current=true;setSaving(true);try{await savePoseSession(result,{expectedUserId:user.id});if(!mounted.current)return;setSaved(true);setMessage('측정 결과를 저장했어요. 지난 측정에서 다시 볼 수 있어요.');await queryClient.invalidateQueries({queryKey:['pose-sessions',user.id]});}catch(error){if(mounted.current)setMessage(['pose_setup_required','pose_conflict'].includes(error.code)?error.message:'결과를 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.');}finally{saveLock.current=false;if(mounted.current)setSaving(false);}}
 async function storeClip(){if(!clip||!saved||upload.current)return;const job=new AbortController();upload.current=job;setUploading(true);try{const existing=await api(`/pose/sessions/${clip.id}/video`,{token,signal:job.signal});if(!existing?.video)await uploadPoseVideo(clip.id,clip,token,job.signal);if(!mounted.current||job.signal.aborted)return;setClip(null);setMessage('영상도 보관했어요. 본인만 볼 수 있고 직접 삭제할 때까지 보관해요.');}catch(error){if(!job.signal.aborted)setMessage(error.message);}finally{if(upload.current===job)upload.current=null;if(mounted.current)setUploading(false);}}
 const matches=GYM_EXERCISE_CRITERIA.filter(item=>`${item.label} ${item.aliases.join(' ')} ${item.equipment.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
 return <div className="pose-page pose-vision-page">{guard}<Link className="pose-back" to="/pose">← 동작 자동 인식으로</Link><header className="pose-page-heading"><div><h1>내 운동 직접 찾기</h1><p>운동을 찾거나 이름을 직접 입력해 주세요.</p></div></header>
 {!active&&status!=='ended'&&<section className="pose-search-panel"><label>운동 검색<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="운동 이름 또는 기구 이름"/></label><div className="pose-direct-local">{Object.entries(EXERCISE_GUIDES).map(([id,guide])=><Link className="btn" key={id} to={`/pose?view=local&exercise=${id}`}>{guide.label} 실시간 측정</Link>)}</div><div className="pose-search-results">{matches.map(item=><button className="pose-exercise-choice" type="button" key={item.id} aria-pressed={selected===item.id} onClick={()=>{setSelected(visionCriteria(item.id)?item.id:'other');setOther(item.label);}}><strong>{item.label}</strong><small>{item.bodyRegion} · {visionCriteria(item.id)?'사진으로 움직임 관찰':'이름·시간 기록'}</small></button>)}</div>{!matches.length&&<p>검색 결과가 없어요. 아래에 운동명을 직접 입력할 수 있어요.</p>}<label className="pose-other-choice"><input type="radio" checked={custom} onChange={()=>setSelected('other')}/> 다른 운동 이름 입력</label>{custom&&<label>운동 이름<input maxLength={60} value={other} onChange={event=>setOther(event.target.value)} placeholder="예: 오늘 한 운동"/><small>확인된 지침이 없어 자세 평가 없이 이름과 시간만 기록해요.</small></label>}</section>}
 <div className="pose-vision-layout"><section className="pose-studio"><h2>{label||'운동을 먼저 선택해 주세요'}</h2><div className="pose-camera"><video ref={video} muted playsInline/>{countdown!==null&&<div className="pose-countdown"><strong>{countdown}</strong><span>몸 전체가 보이게 준비해 주세요</span><button className="btn" onClick={finish}>취소</button></div>}</div>
 {status==='ready'&&<div className="pose-vision-consents">{criterion&&<label className="pose-ai-consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/><span>관찰할 때마다 사진 4장을 OpenAI에 전송하는 데 동의해요.<small>최소 35초 간격으로 화면의 움직임을 확인해요. 원본 사진은 CrewFit에 보관하지 않아요. 횟수나 안전 여부는 판정하지 않아요.</small></span></label>}<label className="pose-video-consent"><input type="checkbox" checked={recordConsent} onChange={event=>setRecordConsent(event.target.checked)}/><span>영상도 남기기 (선택)<small>측정 시작부터 최대 2분 · 무음. 종료 후 별도로 보관하면 본인만 볼 수 있고 직접 삭제할 때까지 보관해요.</small></span></label><button className="btn btn-primary" disabled={!!criterion&&!consent} onClick={begin}>5초 후 {criterion?'관찰':'시간 기록'} 시작</button><button className="btn" onClick={finish}>카메라 끄기</button></div>}
 {status==='running'&&<><p className="pose-vision-time"><strong>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong> 운동 시간 · 횟수는 측정하지 않아요</p>{recordStatus&&<p>{recordStatus==='recording'?'● 처음 2분 영상 녹화 중':recordStatus==='complete'?'녹화 완료 · 관찰과 시간 기록은 계속돼요.':recordStatus}</p>}<button className="btn pose-finish-button" onClick={finish}>종료하고 결과 보기</button>{criterion&&paused&&<button className="btn" disabled={busy} onClick={()=>{const current=run.current;if(current){if(current.gate.remaining()>0){setMessage('다음 관찰까지 잠시 기다려 주세요. 관찰은 최소 35초 간격이에요.');return;}current.gate.resume();setPaused(false);void observe(current);}}}>관찰 다시 시도</button>}<button className="btn" onClick={finish}>운동 다시 선택하기</button></>}
 {!active&&<button className="btn btn-primary" disabled={!label||saving||uploading} onClick={openCamera}>{status==='ended'?'같은 운동 다시 시작':'카메라 켜기'}</button>}
 </section><aside className="pose-vision-observations"><h2>{criterion?'움직임 관찰':'운동 시간 기록'}</h2><p role="status">{busy?'사진 4장으로 움직임을 확인하고 있어요…':message|| (criterion?`${criterion.preferredView}에서 몸 전체와 기구가 보이게 준비하세요.`:'직접 입력한 운동은 자세 평가를 제공하지 않아요.')}</p>{items.map(item=><article key={item.key}><strong>{item.label}</strong><span>{item.status==='uncertain'?'확인 불가':item.status==='improve'?'다음 동작에서 확인':'화면에서 관찰'}</span><p>{item.message}</p></article>)}{criterion&&<><h3>확인할 수 없는 부분</h3><ul>{criterion.notObservable.map(text=><li key={text}>{text}</li>)}</ul><p>몇 장의 사진에 근거한 참고 관찰이에요. 정상·안전한 자세라는 보장은 아니에요. 통증이 있으면 중단하세요.</p><div>{criterion.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗ </a>)}</div></>}
 {status==='ended'&&result&&<div className="pose-result-summary"><strong>{label} · {Math.floor(seconds/60)}분 {seconds%60}초</strong><button className="btn btn-primary" disabled={saving||saved} onClick={save}>{saving?'저장 중…':saved?'결과 저장 완료':'결과 저장'}</button>{clip&&<button className="btn" disabled={!saved||uploading} onClick={storeClip}>{uploading?'영상 보관 중…':'영상도 보관하기'}</button>}{saved&&<PoseVideo sessionId={result.id}/>}<Link className="btn" to="/pose#pose-history-title">지난 측정 보기</Link><button className="btn" disabled={saving||uploading} onClick={chooseAgain}>다른 운동 선택</button></div>}
 </aside></div></div>;
}
