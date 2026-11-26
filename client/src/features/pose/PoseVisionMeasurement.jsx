import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import PoseExercisePicker from './PoseExercisePicker.jsx';
import {capturePoseFrames} from './poseAiCapture.js';
import {requestPoseObservation,validatePoseObservation} from './poseObservation.js';
import {createVisionGate,createVisionRecovery,visionCriteria} from './poseVision.js';
import {createPoseVideoRecorder} from './poseVideoRecorder.js';
import {createPoseScreenLock} from './poseScreenLock.js';
import {waitForPoseCountdown} from './poseCountdown.js';
import {buildPoseSession,savePoseSession,poseToday} from './poseSessions.js';
import PoseVideo,{uploadPoseVideo} from './PoseVideo.jsx';
import PoseConsentPanel from './PoseConsentPanel.jsx';
import {api} from '../../shared/api.js';
import useLeaveGuard from '../../shared/useLeaveGuard.jsx';
import {requestPoseCamera,attachPoseCamera,watchPoseCameraVisibility,poseCameraError} from './poseCamera.js';

export default function PoseVisionMeasurement({pickerFilter,onPickerFilterChange}){
 const {user,token}=useAuth(),queryClient=useQueryClient(),location=useLocation();
 const latestToken=useRef(token);latestToken.current=token;
 const initial=new URLSearchParams(location.search).get('exercise')||'';
 const [selected,setSelected]=useState(visionCriteria(initial)?initial:''),[other,setOther]=useState('');
 const {search,region}=pickerFilter;
 const setSearch=value=>onPickerFilterChange({...pickerFilter,search:value});
 const setRegion=value=>onPickerFilterChange({...pickerFilter,region:value});
 const [choosing,setChoosing]=useState(!visionCriteria(initial));
 const [facing,setFacing]=useState('user');
 const [recordConsent,setRecordConsent]=useState(false),[status,setStatus]=useState('idle'),[countdown,setCountdown]=useState(null),[message,setMessage]=useState(''),[items,setItems]=useState([]),[busy,setBusy]=useState(false),[paused,setPaused]=useState(false),[seconds,setSeconds]=useState(0),[clip,setClip]=useState(null),[recordStatus,setRecordStatus]=useState(''),[result,setResult]=useState(null),[saved,setSaved]=useState(false),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false);
 const [observedAt,setObservedAt]=useState(null),[observationPhase,setObservationPhase]=useState('idle');
 const video=useRef(null),studio=useRef(null),picker=useRef(null),run=useRef(null),prepare=useRef(null),mounted=useRef(true),upload=useRef(null),saveLock=useRef(false),recordingId=useRef(null);
 const criterion=visionCriteria(selected),custom=selected==='other',label=criterion?.label||other.trim();
 const active=['loading','ready','countdown','running'].includes(status);
 useEffect(()=>{if(status!=='running')return;const lock=createPoseScreenLock(navigator.wakeLock);void lock.start();return()=>{void lock.stop();};},[status]);
 const guard=useLeaveGuard(active||Boolean(result&&!saved)||Boolean(clip),'화면을 나가면 카메라가 꺼지고 보관하지 않은 결과와 영상은 사라져요. 나갈까요?');
 function cleanup(){prepare.current?.abort();prepare.current=null;const current=run.current;run.current=null;if(current){clearInterval(current.timer);current.job?.abort();current.recorder?.dispose();current.stream?.getTracks().forEach(track=>track.stop());}if(video.current)video.current.srcObject=null;}
 useEffect(()=>{mounted.current=true;const remove=watchPoseCameraVisibility({getSession:()=>run.current,onHidden:finish});return()=>{mounted.current=false;remove();upload.current?.abort();cleanup();};},[]);
 async function openCamera(){
  if(!label||(!criterion&&!custom)||run.current)return;
  if((result&&!saved||clip)&&!window.confirm('보관하지 않은 결과 또는 영상이 있어요. 지우고 새로 시작할까요?'))return;
  cleanup();setResult(null);setSaved(false);setClip(null);setRecordStatus('');setItems([]);setObservedAt(null);setObservationPhase('idle');setMessage('');setSeconds(0);setStatus('loading');setRecordConsent(false);
  const current={id:crypto.randomUUID(),owner:user.id,criterion, label,items:[],gate:createVisionGate(),recovery:createVisionRecovery(),stream:null,started:null};run.current=current;recordingId.current=current.id;
  try{const stream=await requestPoseCamera({facing});if(!mounted.current||run.current!==current){stream.getTracks().forEach(track=>track.stop());return;}current.stream=stream;if(!await attachPoseCamera(stream,video.current,{isCurrent:()=>mounted.current&&run.current===current}))return;current.previewReady=true;stream.getVideoTracks().forEach(track=>track.onended=()=>{if(run.current===current)finish();});setStatus('ready');}
  catch(error){if(run.current!==current)return;cleanup();setStatus('idle');setMessage(poseCameraError(error));}
 }
 async function observe(current){
  if(run.current!==current||!current.started||!current.criterion||document.hidden||!current.gate.begin())return;
  const job=new AbortController();current.job=job;setBusy(true);setObservationPhase('capturing');const timeout=setTimeout(()=>job.abort(),30000);
  const valid=()=>mounted.current&&run.current===current&&!job.signal.aborted;
  try{const response=await requestPoseObservation({capture:options=>capturePoseFrames(video.current,options),request:options=>{if(valid())setObservationPhase('analyzing');return api('/pose/feedback',options);},getToken:()=>latestToken.current,exercise:current.criterion.id,signal:job.signal,isCurrent:valid});if(!valid())return;
   validatePoseObservation(response,current.criterion.id);
   const observations=response.observations.filter(item=>typeof item.key==='string'&&['confirmed','improve','uncertain'].includes(item.status)&&typeof item.label==='string'&&typeof item.message==='string').slice(0,2);
   current.recovery.reset();current.items=observations.map(item=>({...item,source_id:current.criterion.id}));setItems(current.items);setObservedAt(Math.floor((Date.now()-current.started)/1000));setObservationPhase('waiting');setMessage(response.reason||'화면에서 확인할 수 있는 움직임만 관찰했어요.');
   if(!response.matched){current.gate.pause();setPaused(true);setObservationPhase('paused');setMessage('선택한 운동을 화면에서 확인하지 못해 관찰을 멈췄어요. 몸 전체와 기구가 보이게 조정하거나 운동을 다시 선택해 주세요.');}
  }catch(error){if(mounted.current&&run.current===current){const recovery=current.recovery.failed(error);if(recovery.retry){setObservationPhase('retrying');setMessage(`분석 연결이 잠시 끊겼어요. 35초 뒤 다시 확인해요 (${recovery.failures}/2). 카메라와 시간 기록은 계속돼요.`);}else{current.gate.pause();setPaused(true);setObservationPhase('paused');setMessage(`${error.name==='AbortError'?'분석 응답을 받지 못했어요.':error.message||'관찰하지 못했어요.'} 자동 관찰을 멈췄어요. 연결을 확인한 뒤 다시 시도하거나 운동을 직접 기록할 수 있어요.`);}}}
  finally{clearTimeout(timeout);current.gate.end();if(current.job===job)current.job=null;if(mounted.current&&run.current===current)setBusy(false);}
 }
 async function begin(){
  const current=run.current;if(!current||status!=='ready'||prepare.current)return;
  const job=new AbortController();prepare.current=job;setStatus('countdown');
  try{await waitForPoseCountdown({signal:job.signal,onTick:setCountdown});}catch{return;}
  if(run.current!==current||job.signal.aborted||document.hidden)return;prepare.current=null;setCountdown(null);current.started=Date.now();setStatus('running');setPaused(false);setMessage(current.criterion?'천천히 동작을 보여 주세요. 화면에서 확인할 수 있는 항목을 관찰해요.':'이 운동은 자세를 평가하지 않고 운동명과 시간만 남겨요.');
  if(recordConsent){try{current.recorder=createPoseVideoRecorder({stream:current.stream,onStatus:value=>{if(mounted.current&&run.current===current)setRecordStatus(value);},onComplete:value=>{if(mounted.current&&recordingId.current===current.id)setClip({...value,id:current.id});},onError:error=>{if(mounted.current)setRecordStatus(error.message);}});}catch(error){setRecordStatus(error.message);}}
  setRecordConsent(false);
  current.timer=setInterval(()=>{if(run.current!==current)return;setSeconds(Math.floor((Date.now()-current.started)/1000));void observe(current);},1000);
  void observe(current);
 }
 function chooseAgain(){if(saving||uploading)return;if((result&&!saved||clip)&&!window.confirm('보관하지 않은 결과 또는 영상이 있어요. 지우고 다른 운동을 선택할까요?'))return;cleanup();recordingId.current=null;setResult(null);setClip(null);setSaved(false);setItems([]);setObservedAt(null);setObservationPhase('idle');setMessage('');setStatus('idle');setChoosing(true);requestAnimationFrame(()=>{picker.current?.scrollIntoView({block:'start'});picker.current?.querySelector('input[type="search"]')?.focus({preventScroll:true});});}
 function finish(){
  const current=run.current;if(!current)return;
  const recorder=current.recorder;current.recorder=null;recorder?.stop();
  if(current.started){const duration=Math.max(1,Math.min(86400,Math.round((Date.now()-current.started)/1000)));try{setResult(buildPoseSession({id:current.id,measured_on:poseToday(),exercise:current.criterion?.id||'manual_other',view:current.criterion?'auto':'manual',exercise_label:current.criterion?null:current.label,reps:null,duration_seconds:duration,observations:current.items.map(({key,label,message,source_id})=>({key,label,message,source_id}))}));setSeconds(duration);setMessage(current.items.length?'측정을 마쳤어요. 마지막 관찰 결과를 확인하고 저장해 주세요.':current.criterion?'이번 측정에서는 받은 자세 피드백이 없어요. 운동 이름과 시간은 저장할 수 있어요.':'시간 기록을 마쳤어요. 운동 이름과 시간을 저장할 수 있어요.');}catch{setMessage('측정 요약을 만들지 못했어요. 결과 저장 형식을 확인해 주세요.');}}
  cleanup();setCountdown(null);setBusy(false);setPaused(false);setObservationPhase('ended');setStatus(current.started?'ended':'idle');
 }
 async function save(){if(!result||saveLock.current)return;saveLock.current=true;setSaving(true);try{await savePoseSession(result,{expectedUserId:user.id});if(!mounted.current)return;setSaved(true);setMessage('측정 결과를 저장했어요. 지난 측정에서 다시 볼 수 있어요.');await queryClient.invalidateQueries({queryKey:['pose-sessions',user.id]});}catch(error){if(mounted.current)setMessage(['pose_setup_required','pose_conflict'].includes(error.code)?error.message:'결과를 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.');}finally{saveLock.current=false;if(mounted.current)setSaving(false);}}
 async function storeClip(){if(!clip||!saved||upload.current)return;const job=new AbortController();upload.current=job;setUploading(true);try{const existing=await api(`/pose/sessions/${clip.id}/video`,{token,signal:job.signal});if(!existing?.video)await uploadPoseVideo(clip.id,clip,token,job.signal);if(!mounted.current||job.signal.aborted)return;setClip(null);setMessage('영상도 보관했어요. 본인만 볼 수 있고 직접 삭제할 때까지 보관해요.');}catch(error){if(!job.signal.aborted)setMessage(error.message);}finally{if(upload.current===job)upload.current=null;if(mounted.current)setUploading(false);}}
 function chooseExercise(id,name){setSelected(id);setOther(name);setChoosing(false);requestAnimationFrame(()=>{studio.current?.scrollIntoView({block:'start'});studio.current?.focus({preventScroll:true});});}
 return <div className={`pose-page pose-vision-page ${!active&&status!=='ended'?'pose-idle':''} ${active?'pose-active':''} ${status==='ready'?'pose-preparing':''} ${choosing?'pose-picker-page':''}`}>{guard}<Link className="pose-back" to="/coach">← 코칭으로</Link>{active&&<h1 className="pose-active-title">자세 측정 · {label}</h1>}<header className="pose-page-heading"><div><h1>{choosing?'어떤 운동을 할까요?':'자세 측정'}</h1></div>{!active&&<Link className="pose-history-link" to="/pose?view=history#pose-history-title">지난 측정</Link>}</header>
 {!active&&status!=='ended'&&choosing&&<><div ref={picker} className="pose-picker-host"><PoseExercisePicker search={search} onSearch={setSearch} region={region} onRegionChange={setRegion} selected={selected} other={other} onSelect={chooseExercise} onCustom={()=>setSelected('other')} onOtherChange={setOther}/></div><div className="pose-entry-links pose-picker-links"><Link to="/pose?view=auto">운동 자동으로 찾기</Link><Link to="/pose?view=criteria">운동별 측정 기준</Link></div></>}
 <div className={`pose-vision-layout ${!['running','ended'].includes(status)?'pose-layout-single':''}`} hidden={!selected||choosing}><section ref={studio} tabIndex={-1} className="pose-studio"><div className="pose-studio-heading"><strong>{label||'운동 이름을 입력해 주세요'}</strong>{!active&&status!=='ended'&&<button type="button" className="btn btn-ghost" onClick={chooseAgain}>운동 다시 찾기</button>}</div>
 {!active&&<div className="pose-camera-entry"><p className="pose-selected-method">{criterion?'사진 관찰 · 횟수 미측정':'운동 시간 기록 · 자세 평가 없음'}</p><div className="pose-controls"><label>촬영 카메라<select value={facing} onChange={event=>setFacing(event.target.value)}><option value="user">전면 카메라</option><option value="environment">후면 카메라</option></select></label><button className="btn btn-primary" disabled={!label||saving||uploading} onClick={openCamera}>{status==='ended'?'같은 운동 다시 시작':'카메라 켜기'}</button></div></div>}
 {status==='idle'&&message&&<p className="pose-error" role="status">{message}</p>}
 <div className={`pose-camera ${facing==='user'?'pose-mirror':''}`}><video ref={video} muted playsInline autoPlay/>{!active&&<div className="pose-placeholder"><strong>{label?`${label} 촬영 준비`:'운동 이름을 입력해 주세요'}</strong><span>{criterion?`${criterion.preferredView}에서 몸 전체와 기구가 보이게`:'몸 전체가 보이게 준비해 주세요.'}</span></div>}{status==='loading'&&<div className="pose-placeholder" role="status"><strong>카메라를 연결하고 있어요</strong><span>권한 안내가 나오면 카메라 사용을 허용해 주세요.</span><button className="btn" onClick={finish}>취소</button></div>}{countdown!==null&&<div className="pose-countdown"><strong>{countdown}</strong><span>몸 전체가 보이게 준비해 주세요</span><button className="btn" onClick={finish}>취소</button></div>}</div>
 {status==='running'&&criterion&&<div className="pose-observation-live" data-paused={paused} role="status"><strong>{observationPhase==='capturing'?'동작을 천천히 보여 주세요':observationPhase==='analyzing'?'피드백을 만들고 있어요':paused?'사진 관찰이 멈췄어요':observationPhase==='retrying'?'분석 연결을 다시 확인해요':'움직임을 관찰하고 있어요'}</strong><p>{observationPhase==='capturing'?'몸 전체와 기구가 보이게 동작을 이어가 주세요.':observationPhase==='analyzing'?'촬영을 마쳤어요. 잠시 편하게 쉬어도 돼요.':message}</p></div>}
 {status==='ready'&&<PoseConsentPanel mode={criterion?'observation':'timer'}
  recordConsent={recordConsent} onRecordConsentChange={setRecordConsent} onStart={begin} onCancel={finish}
  startLabel={criterion?'관찰 시작':'시간 기록 시작'}/>}
 {status==='running'&&<><p className="pose-vision-time"><strong>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong> 운동 시간 · 횟수는 측정하지 않아요</p>{recordStatus&&<p>{recordStatus==='recording'?'● 처음 2분 영상 녹화 중':recordStatus==='complete'?'녹화 완료 · 관찰과 시간 기록은 계속돼요.':recordStatus}</p>}<button className="btn pose-finish-button" onClick={finish}>종료하고 결과 보기</button>{criterion&&paused&&<button className="btn" disabled={busy} onClick={()=>{const current=run.current;if(current){if(current.gate.remaining()>0){setMessage('다음 관찰까지 잠시 기다려 주세요. 관찰은 최소 35초 간격이에요.');return;}current.recovery.reset();current.gate.resume();setPaused(false);void observe(current);}}}>관찰 다시 시도</button>}{criterion&&paused&&<Link className="btn" to="/activities/new?sport=gym">운동 직접 기록</Link>}</>}
 </section><aside className="pose-vision-observations" hidden={!['running','ended'].includes(status)}><h2>{criterion?'움직임 관찰':'운동 시간 기록'}</h2><p role="status" hidden={status==='running'}>{busy?'사진 4장으로 움직임을 확인하고 있어요…':message|| (criterion?`${criterion.preferredView}에서 몸 전체와 기구가 보이게 준비하세요.`:'직접 입력한 운동은 자세 평가를 제공하지 않아요.')}</p>{observedAt!==null&&items.length>0&&<p className="pose-observation-updated">측정 {Math.floor(observedAt/60)}분 {observedAt%60}초에 받은 관찰</p>}{status==='running'&&criterion&&!items.length&&<p>{paused?'아직 받은 피드백이 없어요.':busy?'첫 관찰 결과를 기다리고 있어요.':'확인할 수 있는 항목이 생기면 여기에 보여드려요.'}</p>}{items.map(item=><article key={item.key}><strong>{item.label}</strong><span>{item.status==='uncertain'?'확인 불가':item.status==='improve'?'다음 동작에서 확인':'화면에서 관찰'}</span><p>{item.message}</p></article>)}{criterion&&<p className="pose-limit">사진에 근거한 참고 결과예요. <Link to="/pose?view=criteria">운동별 측정 기준</Link></p>}
 {status==='ended'&&result&&<div className="pose-result-summary"><strong>{label} · {Math.floor(seconds/60)}분 {seconds%60}초</strong><button className="btn btn-primary" disabled={saving||saved} onClick={save}>{saving?'저장 중…':saved?'결과 저장 완료':'결과 저장'}</button>{clip&&<button className="btn" disabled={!saved||uploading} onClick={storeClip}>{uploading?'영상 보관 중…':'영상도 보관하기'}</button>}{saved&&<PoseVideo sessionId={result.id}/>}<Link className="btn" to="/pose?view=history#pose-history-title">지난 측정 보기</Link><button className="btn" disabled={saving||uploading} onClick={chooseAgain}>다른 운동 선택</button></div>}
 </aside></div>{!active&&<div className="pose-entry-settings"><Link to="/me/settings#profile-analysis">사진 분석 설정</Link></div>}</div>;
}
