import PoseVisionMeasurement from './PoseVisionMeasurement.jsx';
import {classifiedVisionCriteria,visionCriteria} from './poseVision.js';
import {createPoseVideoRecorder} from './poseVideoRecorder.js';
import PoseVideo,{uploadPoseVideo} from './PoseVideo.jsx';
import ExerciseCriteriaPanel from './ExerciseCriteriaPanel.jsx';
import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router';
import {createRepCounter} from './poseAnalysis.js';
import {analyzeExercise,createExerciseFeedback} from './exerciseAnalysis.js';
import {EXERCISE_GUIDES,getExerciseGuide} from './exerciseGuides.js';
import {useAuth} from '../auth/index.js';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {buildPoseSession,savePoseSession,listPoseSessions,poseToday} from './poseSessions.js';
import {createPoseScreenLock} from './poseScreenLock.js';
import useLeaveGuard from '../../shared/useLeaveGuard.jsx';
import {api} from '../../shared/api.js';
import {capturePoseFrames,supportedAiSelection} from './poseAiCapture.js';
import {waitForPoseCountdown} from './poseCountdown.js';
import './pose.css';


const MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const INITIAL={count:0,angle:null,message:'카메라를 켜고 측면으로 서 주세요.'};
const storageUnavailable=error=>['42P01','PGRST205'].includes(error?.code);
export default function PosePage(){
 const {search}=useLocation();
 const {user}=useAuth();
 const params=new URLSearchParams(search);
 return params.get('view')==='criteria'?<ExerciseCriteriaPanel/>:params.get('view')==='manual'?<PoseVisionMeasurement key={`${user?.id}:${search}`}/>:<PoseMeasurement key={`${user?.id}:${search}`}/>;
}
function PoseMeasurement(){
 const {user,token}=useAuth(),queryClient=useQueryClient();
 const location=useLocation();
 const currentOwner=useRef(user?.id);currentOwner.current=user?.id;
 const measurement=useRef(null),savingLock=useRef(false);
 const recorder=useRef(null),videoJob=useRef(null);
 const [recordConsent,setRecordConsent]=useState(false),[clip,setClip]=useState(null),[recordState,setRecordState]=useState('idle'),[videoMessage,setVideoMessage]=useState(''),[uploadState,setUploadState]=useState('idle');
 function clearRecording(){recorder.current?.dispose();recorder.current=null;videoJob.current?.abort();videoJob.current=null;setClip(null);setRecordConsent(false);setRecordState('idle');setVideoMessage('');setUploadState('idle');}
 async function storeVideo(){
  if(!clip||!result||clip.id!==result.payload.id||result.owner!==user?.id||saveState!=='saved'||videoJob.current)return;
  const owner=user.id,controller=new AbortController();videoJob.current=controller;setUploadState('saving');setVideoMessage('');
  try{const existing=await api(`/pose/sessions/${encodeURIComponent(clip.id)}/video`,{token,signal:controller.signal});if(!existing?.video)await uploadPoseVideo(clip.id,clip,token,controller.signal);if(controller.signal.aborted||currentOwner.current!==owner)return;setUploadState('saved');setClip(null);setVideoMessage('영상도 보관했어요. 지난 측정에서 다시 볼 수 있고, 직접 삭제할 때까지 보관해요.');}
  catch(error){if(!controller.signal.aborted&&currentOwner.current===owner){setUploadState('error');setVideoMessage(error.message||'영상을 보관하지 못했어요. 결과는 저장되어 있어요.');}}
  finally{if(videoJob.current===controller)videoJob.current=null;}
 }

 const [result,setResult]=useState(null),[saveState,setSaveState]=useState('idle'),[saveError,setSaveError]=useState('');
 const history=useQuery({queryKey:['pose-sessions',user?.id],queryFn:()=>listPoseSessions({limit:20,expectedUserId:user.id}),enabled:!!user?.id,retry:(count,error)=>!storageUnavailable(error)&&count<2});
 useEffect(()=>{if(location.hash==='#pose-history-title')document.getElementById('pose-history-title')?.scrollIntoView({block:'start'});},[location.hash,history.isPending]);
 const video=useRef(null),canvas=useRef(null),session=useRef(null),generation=useRef(0),counter=useRef(createRepCounter()),measuring=useRef(false);
 const initialExercise=new URLSearchParams(location.search).get('exercise');
 const initialLocal=Object.hasOwn(EXERCISE_GUIDES,initialExercise)?initialExercise:'squat';
 const initialView=EXERCISE_GUIDES[initialLocal].views[0].id;
 const initialMode=new URLSearchParams(location.search).get('view')==='local'?'manual':'ai';
 const [exercise,setExercise]=useState(initialLocal),[view,setView]=useState(initialView);
 const [selectionMode,setSelectionMode]=useState(initialMode);
 const selection=useRef({exercise:initialLocal,view:initialView}),mode=useRef(initialMode);
 const [aiConsent,setAiConsent]=useState(false),[aiState,setAiState]=useState('idle'),[aiProgress,setAiProgress]=useState(0),[aiResult,setAiResult]=useState(null),[aiError,setAiError]=useState('');
 const aiJob=useRef(null),preparation=useRef(null),prepareButton=useRef(null);
 const [countdown,setCountdown]=useState(null);
 function cancelPreparation(){const job=preparation.current;preparation.current=null;job?.abort();setCountdown(null);}
 function cancelCountdown(){cancelPreparation();cancelAi();setStatus('ready');requestAnimationFrame(()=>prepareButton.current?.focus());}
 function cancelAi(){if(aiJob.current)cancelPreparation();const job=aiJob.current;aiJob.current=null;job?.abort();setAiState('idle');setAiConsent(false);setAiResult(null);setAiError('');}
 async function classifyAi(){
  if(!aiConsent||!token||!user?.id||status!=='ready'||mode.current!=='ai'||aiJob.current||document.hidden)return;
  const job=new AbortController(),owner=user.id,cameraGeneration=generation.current;aiJob.current=job;setAiState('countdown');setAiProgress(0);setAiResult(null);setAiError('');
  let timedOut=false,frames=[];const timeout=setTimeout(()=>{timedOut=true;job.abort();},30000);
  const current=()=>aiJob.current===job&&currentOwner.current===owner&&generation.current===cameraGeneration&&mode.current==='ai'&&Boolean(session.current);
  try{
   preparation.current=job;
   await waitForPoseCountdown({signal:job.signal,onTick:setCountdown});
   if(!current()||job.signal.aborted||document.hidden)return;
   preparation.current=null;setCountdown(null);setAiState('capturing');
   frames=await capturePoseFrames(video.current,{signal:job.signal,onProgress:n=>{if(current())setAiProgress(n);}});
   if(!current()||job.signal.aborted)return;setAiState('analyzing');
   const response=await api('/pose/classify',{token,body:{consent:true,frames},signal:job.signal});
   if(!current()||job.signal.aborted)return;
   if(!response||typeof response.label!=='string'||typeof response.reason!=='string')throw new Error('분석 결과를 확인하지 못했어요. 다시 시도하거나 직접 선택해 주세요.');
   setAiResult(response);clearTimeout(timeout);frames.length=0;
   const chosen=supportedAiSelection(response);
   if(!chosen){setAiState('done');return;}
   applySelection(chosen);setAiState('starting');setStatus('countdown');preparation.current=job;
   await waitForPoseCountdown({signal:job.signal,onTick:setCountdown,seconds:3});
   if(!current()||job.signal.aborted||document.hidden)return;
   preparation.current=null;setCountdown(null);activateMeasurement(chosen,owner);setAiState('done');
  }catch(err){if(current()){setAiState('idle');setStatus('ready');setAiError(timedOut?'분석 시간이 길어져 중단했어요. 다시 시도하거나 직접 선택해 주세요.':err.name==='AbortError'?'':err.message||'분석하지 못했어요. 직접 운동을 선택할 수 있어요.');}}
  finally{clearTimeout(timeout);frames.length=0;if(current()){preparation.current=null;setCountdown(null);aiJob.current=null;setAiConsent(false);}}
 }
 const guide=getExerciseGuide(exercise,view);
 function applySelection(next){selection.current=next;setExercise(next.exercise);setView(next.view);}
 const feedbackEngine=useRef(createExerciseFeedback('squat','side')),observations=useRef(new Map());
 const [feedback,setFeedback]=useState(null);
 const [status,setStatus]=useState('idle'),[stats,setStats]=useState(INITIAL),[error,setError]=useState(''),[facing,setFacing]=useState('user');
 function dispose(){recorder.current?.dispose();recorder.current=null;cancelPreparation();cancelAi();generation.current++;measuring.current=false;const s=session.current;session.current=null;if(s){cancelAnimationFrame(s.frame);s.stream?.getTracks().forEach(t=>t.stop());s.model?.close();}if(video.current)video.current.srcObject=null;canvas.current?.getContext('2d').clearRect(0,0,canvas.current.width,canvas.current.height);}
 function stop(message='측정을 마쳤어요. 결과를 확인한 뒤 내 계정에 저장할 수 있어요.'){
  const m=measurement.current,wasMeasuring=measuring.current;
  const finishedRecorder=recorder.current;recorder.current=null;finishedRecorder?.stop();
  if(measuring.current){
   const items=[...observations.current.values()];
   setFeedback({ready:false,items,summary:items.length?'이번 측정 중 지속해서 감지된 항목이에요. 다음 동작에서 확인해 보세요.':'지속된 확인 신호는 없었어요. 올바른 자세라는 판정은 아니에요.'});
   if(m?.validFrames>=12){try{setResult({owner:m.owner,payload:buildPoseSession({id:m.id,measured_on:m.day,exercise:m.exercise,view:m.view,reps:m.front?null:m.count,duration_seconds:Math.max(1,Math.min(86400,Math.round((Date.now()-m.started)/1000))),observations:items.map(({key,label,message})=>({key,label,message}))})});}catch{setResult(null);setError('측정 요약을 만들지 못했어요. 카메라는 종료됐으며, 다시 측정할 수 있어요.');}}
   else{setResult(null);setFeedback({ready:false,items:[],summary:'인식 시간이 부족해 저장할 결과를 만들지 못했어요. 몸 전체가 보이도록 카메라를 조정한 뒤 다시 측정해 주세요.'});}
  }
  dispose();setStatus(wasMeasuring?'ended':'idle');setStats(old=>({...old,angle:null,message}));
 }
 async function beginMeasurement(){
  if(!user?.id||status!=='ready'||mode.current==='ai'||preparation.current||document.hidden||!session.current)return;
  const chosen={...selection.current};
  const job=new AbortController(),owner=user.id,id=generation.current;preparation.current=job;
  applySelection(chosen);setStatus('countdown');
  try{await waitForPoseCountdown({signal:job.signal,onTick:setCountdown});}
  catch(error){if(error.name!=='AbortError')setError('준비를 시작하지 못했어요. 다시 시도해 주세요.');return;}
  if(preparation.current!==job||job.signal.aborted||currentOwner.current!==owner||generation.current!==id||document.hidden||!session.current)return;
  preparation.current=null;setCountdown(null);
  activateMeasurement(chosen,owner);
 }
 function activateMeasurement(chosen,owner){
  const chosenGuide=getExerciseGuide(chosen.exercise,chosen.view);
  counter.current.reset();feedbackEngine.current=createExerciseFeedback(chosen.exercise,chosen.view);observations.current.clear();setFeedback(null);setStats({...INITIAL,message:'기준 자세를 확인하고 있어요.'});
  measurement.current={id:crypto.randomUUID(),owner,day:poseToday(),exercise:chosen.exercise,view:chosen.view,front:chosenGuide.front,started:Date.now(),validFrames:0,count:0};
  measuring.current=true;setStatus('running');
  if(recordConsent){const id=measurement.current.id;try{recorder.current=createPoseVideoRecorder({stream:session.current.stream,onStatus:state=>{if(currentOwner.current===owner&&measurement.current?.id===id)setRecordState(state);},onComplete:recording=>{if(currentOwner.current===owner&&measurement.current?.id===id)setClip({...recording,id});},onError:error=>{if(currentOwner.current===owner&&measurement.current?.id===id){setRecordState('error');setVideoMessage(error.message);}}});}catch(error){setRecordState('error');setVideoMessage(error.message);}}
  setRecordConsent(false);
 }
 async function saveResult(){
  if(!result||result.owner!==user?.id||savingLock.current||saveState==='saved')return;
  savingLock.current=true;setSaveState('saving');setSaveError('');
  try{await savePoseSession(result.payload,{expectedUserId:result.owner});if(currentOwner.current!==result.owner)return;setSaveState('saved');await queryClient.invalidateQueries({queryKey:['pose-sessions',result.owner]});}
  catch(error){if(currentOwner.current!==result.owner)return;setSaveState('error');setSaveError(storageUnavailable(error)?'지금은 결과를 저장할 수 없어요. 잠시 후 다시 시도해 주세요.':'저장하지 못했어요. 연결을 확인한 뒤 다시 눌러 주세요. 같은 결과는 중복 저장되지 않아요.');}
  finally{savingLock.current=false;}
 }
 useEffect(()=>{const hide=()=>{if(document.hidden&&session.current)stop('화면을 벗어나 카메라를 껐어요. 다시 시작할 수 있어요.');};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);measurement.current=null;videoJob.current?.abort();dispose();};},[]);
 useEffect(()=>{clearRecording();dispose();measurement.current=null;setResult(null);setFeedback(null);setStats(INITIAL);setStatus('idle');setSaveState('idle');setSaveError('');},[user?.id]);
 function canReplaceResult(){
  if(clip&&uploadState!=='saved'&&!window.confirm('아직 보관하지 않은 영상이 있어요. 영상을 지우고 계속할까요?'))return false;
  return !result||saveState==='saved'||window.confirm('아직 저장하지 않은 측정 결과가 있어요. 이 결과를 지우고 계속할까요?');
 }
 async function start(nextMode=null){
  if(savingLock.current||videoJob.current||!canReplaceResult())return;
  if(nextMode){mode.current=nextMode;setSelectionMode(nextMode);}
  clearRecording();measurement.current=null;setResult(null);setSaveState('idle');setSaveError('');
  dispose();counter.current.reset();feedbackEngine.current=createExerciseFeedback(exercise,view);feedbackEngine.current.reset();observations.current.clear();setFeedback(null);setStats(INITIAL);setError('');
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setError('이 주소에서는 카메라를 켤 수 없어요. CrewFit의 보안 연결(https) 주소로 다시 접속해 주세요.');return;}
  const id=generation.current,s={stream:null,model:null,frame:0};session.current=s;setStatus('loading');
  try{
   s.stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:exercise==='pushup'?640:480},height:{ideal:exercise==='pushup'?480:640}}});
   if(id!==generation.current){s.stream.getTracks().forEach(t=>t.stop());return;}
   s.stream.getVideoTracks().forEach(t=>{t.onended=()=>{if(id===generation.current)stop('카메라 연결이 종료됐어요. 다시 연결해 주세요.');};});
   video.current.srcObject=s.stream;await video.current.play();
   const {FilesetResolver,PoseLandmarker}=await import('@mediapipe/tasks-vision');
   if(id!==generation.current)return;
   const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm');
   if(id!==generation.current)return;
   const model=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:MODEL},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.65,minPosePresenceConfidence:.65,minTrackingConfidence:.65});
   if(id!==generation.current){model.close();return;}s.model=model;setStatus('ready');
   let last=0,lastVideo=-1,lastSide=null;
   function tick(now){
    if(id!==generation.current)return;
    try{const v=video.current,c=canvas.current;
     if(v?.readyState>=2&&now-last>=120&&v.currentTime!==lastVideo){last=now;lastVideo=v.currentTime;c.width=v.videoWidth;c.height=v.videoHeight;
      if(mode.current==='ai'&&!measuring.current){c.getContext('2d').clearRect(0,0,c.width,c.height);s.frame=requestAnimationFrame(tick);return;}
      const result=model.detectForVideo(v,now);
      const chosen=selection.current,currentGuide=getExerciseGuide(chosen.exercise,chosen.view);
      const pose=analyzeExercise(result.landmarks?.[0],v.videoWidth,v.videoHeight,chosen.exercise,chosen.view),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
      if(pose.valid){const points=Object.values(pose.points);ctx.strokeStyle='#b8f575';ctx.fillStyle='#b8f575';ctx.lineWidth=5;
       const segments=pose.segments||[['shoulder','hip'],['hip','knee'],['knee','ankle']];
       for(const [a,b] of segments){const from=pose.points[a],to=pose.points[b];if(!from||!to)continue;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();}
       points.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill();});}

      let currentFeedback=null;if(measuring.current){const next=feedbackEngine.current.update(pose,result.landmarks?.[0],v.videoWidth,v.videoHeight,now);next.items.filter(item=>item.state==='observe'&&!['depth','angle'].includes(item.key)).forEach(item=>observations.current.set(item.key,item));setFeedback(next);currentFeedback=next;}
      if(lastSide&&pose.side!==lastSide)counter.current.update(null,now);lastSide=pose.side;
      const rep=measuring.current&&!currentGuide.front?counter.current.update(pose.valid&&currentFeedback?.ready?pose.angle:null,now):{count:0,phase:'waiting'};
      if(measuring.current&&measurement.current){measurement.current.count=rep.count;if(pose.valid&&currentFeedback?.ready)measurement.current.validFrames++;}
      setStats({count:rep.count,angle:pose.valid&&Number.isFinite(pose.angle)?Math.round(pose.angle):null,message:measuring.current&&!currentFeedback?.ready?currentFeedback?.summary:!pose.valid?pose.message:!measuring.current?'촬영 위치를 확인한 뒤 측정을 시작하세요.':currentFeedback?.items.find(item=>item.state==='observe'&&!['depth','angle'].includes(item.key))?.message|| (currentGuide.front?'양쪽 무릎의 움직임을 관찰하고 있어요.':rep.phase==='down'?'편안한 속도로 시작 자세로 돌아오세요.':'천천히 움직여 주세요. 무리해서 각도를 만들지 마세요.')});
     }s.frame=requestAnimationFrame(tick);
    }catch{stop('분석이 중단됐어요. 카메라를 다시 켜 주세요.');setError('이 기기에서 자세 분석을 계속할 수 없어요. 다른 브라우저로 다시 시도해 주세요.');}
   }s.frame=requestAnimationFrame(tick);
  }catch(err){if(id!==generation.current)return;dispose();setStatus('idle');setError(err.name==='NotAllowedError'?'카메라 권한이 필요해요. 브라우저의 사이트 권한에서 허용한 뒤 다시 시도해 주세요.':err.name==='NotFoundError'?'사용할 수 있는 카메라가 없어요. 카메라가 있는 기기에서 열어 주세요.':'자세 확인을 시작하지 못했어요. 인터넷 연결과 카메라 사용 상태를 확인한 뒤 다시 시도해 주세요.');}
 }
 const active=['loading','ready','countdown','running'].includes(status);
 const aiBusy=['countdown','capturing','analyzing','starting'].includes(aiState);
 const guardDialog=useLeaveGuard(active||Boolean(clip)||Boolean(result&&saveState!=='saved'), active?'화면을 나가면 카메라가 꺼지고 이번 측정은 저장되지 않아요. 나갈까요?':'아직 보관하지 않은 측정 결과 또는 영상이 있어요. 저장하지 않고 나갈까요?');
 useEffect(()=>{if(!active)return;const lock=createPoseScreenLock(navigator.wakeLock);void lock.start();return()=>{void lock.stop();};},[active]);
 function changeMode(nextExercise,nextView){
  if(measuring.current||preparation.current||status==='loading'||savingLock.current||(nextExercise===exercise&&nextView===view)||!canReplaceResult())return;clearRecording();measurement.current=null;cancelAi();setResult(null);setSaveState('idle');setSaveError('');applySelection({exercise:nextExercise,view:nextView});if(status!=='ready')setStatus('idle');setStats(INITIAL);setFeedback(null);setError('');observations.current.clear();counter.current.reset();
 }
 function changeSelectionMode(next){
  if(measuring.current||preparation.current||status==='loading'||savingLock.current||!canReplaceResult())return;
  clearRecording();measurement.current=null;cancelAi();mode.current=next;setSelectionMode(next);setResult(null);setFeedback(null);setSaveState('idle');setSaveError('');if(status==='ended')setStatus('idle');
 }
 const modeControls=<div className="pose-mode-options" role="group" aria-label="다른 측정 방법">{selectionMode!=='ai'?<button type="button" disabled={!!preparation.current} onClick={()=>changeSelectionMode('ai')}>동작 자동 인식으로 돌아가기</button>:(aiError||aiResult)&&<button type="button" disabled={!!preparation.current||!!aiJob.current} onClick={()=>changeSelectionMode('manual')}>인식이 어렵다면 직접 선택</button>}</div>;
 const selectionPanel=selectionMode==='manual'?<section className="pose-selection" hidden={active} aria-label="직접 운동 선택">
   <div className="pose-section-label"><h2>직접 선택해서 측정하기</h2></div>
   <div className="pose-exercise-options" role="group" aria-label="운동 선택">{Object.entries(EXERCISE_GUIDES).map(([key,g])=><button key={key} type="button" disabled={active||saveState==='saving'} aria-pressed={exercise===key} onClick={()=>changeMode(key,g.views[0].id)}><PoseIllustration exercise={key}/><div><strong>{g.label}</strong><span>{g.scope}</span></div><i aria-hidden="true">{exercise===key?'✓':'+'}</i></button>)}</div>
   <div className="pose-direction"><strong>촬영 방향</strong><div role="group" aria-label="촬영 방향">{guide.views.map(v=><button key={v.id} type="button" disabled={active||saveState==='saving'} aria-pressed={view===v.id} onClick={()=>changeMode(exercise,v.id)}>{v.label}</button>)}</div><small>{guide.scope}</small></div>
   <p className="pose-selection-caption">{guide.evaluates}{guide.front?' · 정면에서는 횟수와 깊이를 측정하지 않아요.':''}</p>{modeControls}
  </section>:null;
 const aiPanel=<div className="pose-ai-panel">
  <strong>움직임을 보여 주면 측정이 이어져요</strong>
  <p id="pose-ai-disclosure">동의하고 시작하면 5초 준비 후 약 3초 동안 촬영한 사진 4장이 CrewFit 서버를 거쳐 OpenAI로 전송돼요. 동작과 방향을 확인하면 추가 선택 없이 측정을 시작해요. 원본 이미지는 CrewFit에 저장하지 않아요.</p>
  <p>몸 전체와 운동기구가 보이게 준비해 주세요. 소리는 녹음하지 않아요. 실시간 관절 피드백은 맨몸 스쿼트·제자리 런지·바닥 푸시업을 지원해요. 다른 운동은 별도 동의 후 사진으로 움직임을 관찰해요.</p>
  <label className="pose-ai-consent"><input ref={prepareButton} type="checkbox" checked={aiConsent} disabled={['countdown','capturing','analyzing','starting'].includes(aiState)} onChange={e=>setAiConsent(e.target.checked)} aria-describedby="pose-ai-disclosure"/><span>사진 4장을 OpenAI에 보내 동작을 분석하는 데 동의해요.</span></label>
  <div className="pose-ai-actions"><button type="button" className="btn btn-primary" disabled={!aiConsent||!!aiJob.current} onClick={classifyAi}>{aiResult||aiError?'동의하고 다시 인식':'동의하고 자동 인식 시작'}</button>{['countdown','capturing','analyzing','starting'].includes(aiState)&&<button type="button" className="btn" onClick={cancelCountdown}>인식 취소</button>}</div>
  <div className="pose-ai-progress" role="status" aria-live="polite">{aiState==='capturing'?`천천히 동작을 보여 주세요 · ${aiProgress}/4장 촬영`:aiState==='analyzing'?'동작과 촬영 방향을 확인하고 있어요. 잠시 편하게 쉬어 주세요.':''}</div>
  {aiError&&<p className="pose-error" role="alert">{aiError}</p>}
  {aiResult&&!supportedAiSelection(aiResult)&&<div className="pose-ai-result" role="status"><strong>{aiResult.label}</strong><p>{aiResult.reason}</p><p>{classifiedVisionCriteria(aiResult)?'이 운동은 사진으로 움직임을 관찰할 수 있어요. 아래에서 별도 전송 동의 후 시작해 주세요.':'이번에는 자세 측정을 시작하지 않았어요. 전신과 움직임이 보이게 다시 촬영하거나 직접 운동을 선택해 주세요.'}</p></div>}
  {aiResult&&classifiedVisionCriteria(aiResult)&&<Link className="btn btn-primary" to={`/pose?view=manual&exercise=${encodeURIComponent(aiResult.criteriaId)}`}>{aiResult.label} 움직임 관찰하기</Link>}
  <Link className="btn" to="/pose?view=manual">운동 직접 찾기 · 이름 입력</Link>{modeControls}
 </div>;
 const studioPanel=<section className="pose-studio" aria-label="카메라와 측정">
    <div className="pose-studio-heading"><div><span className="pose-studio-eyebrow">{status==='ended'?'다음 측정':active?'카메라':'카메라 준비'}</span><strong>{selectionMode==='ai'&&status!=='running'&&aiState!=='starting'&&status!=='ended'?'동작 자동 인식':<>{guide.label} <small>{guide.viewLabel}</small></>}</strong></div><span className={`pose-state-badge ${status==='running'?'is-running':''}`}>{countdown!==null?'준비 중':status==='running'?'측정 중':status==='loading'?'연결 중':status==='ready'?'준비 완료':status==='ended'?'측정 종료':'시작 전'}</span></div>
    <div className={`pose-camera ${facing==='user'?'pose-mirror':''}`}>
     <video ref={video} muted playsInline/><canvas ref={canvas} aria-hidden="true"/>
     {active&&countdown===null&&status!=='running'&&<button className="pose-stop-overlay" onClick={()=>stop()} aria-label={status==='running'?'측정 종료하고 카메라 끄기':'카메라 끄기'}>■ {status==='running'?'측정 종료':'카메라 끄기'}</button>}
     {countdown!==null&&<div className="pose-countdown" role="status" aria-live="assertive" aria-atomic="true"><span>{aiState==='starting'?`${guide.label} · 곧 측정 시작`:selectionMode==='ai'?'동작 인식 준비':'측정 준비'}</span><strong>{countdown}</strong><p>{aiState==='starting'?guide.setup:'화면에서 떨어져 몸 전체가 보이게 준비하세요.'}</p><button type="button" className="btn" autoFocus onClick={cancelCountdown}>준비 취소</button></div>}
     {selectionMode==='ai'&&['capturing','analyzing'].includes(aiState)&&<div className="pose-recognition-overlay" role="status" aria-live="polite"><strong>{aiState==='capturing'?'천천히 동작을 보여 주세요':'동작을 확인하고 있어요'}</strong><span>{aiState==='capturing'?`${aiProgress}/4장 촬영 · 몸 전체가 보이게`:'잠시 편하게 쉬어 주세요'}</span><button className="btn" type="button" onClick={cancelCountdown}>인식 취소</button></div>}
     {!active&&<div className="pose-placeholder"><PoseIllustration exercise={exercise} front={selectionMode==='ai'||guide.front}/><strong>{selectionMode==='ai'?'운동을 미리 고르지 않아도 돼요':guide.front?'정면에서 양쪽 다리가 보이게':exercise==='pushup'?'옆에서 몸 전체가 보이게':exercise==='lunge'?'옆에서 앞다리와 발끝이 보이게':'옆에서 몸과 발끝이 보이게'}</strong><span>{selectionMode==='ai'?'전신이 보이도록 준비':guide.viewLabel} · 카메라 고정</span></div>}
    </div>
    {status==='ready'&&countdown===null&&!aiBusy&&<div className="pose-ready-selection">{selectionMode==='ai'?aiPanel:<><div className="pose-ready-fields"><label>운동<select value={exercise} onChange={e=>changeMode(e.target.value,EXERCISE_GUIDES[e.target.value].views[0].id)}>{Object.entries(EXERCISE_GUIDES).map(([key,g])=><option key={key} value={key}>{g.label}</option>)}</select></label><label>촬영 방향<select value={view} onChange={e=>changeMode(exercise,e.target.value)}>{guide.views.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label><p>{guide.setup}</p></div>{modeControls}</>}</div>}
    {status==='ready'&&!aiBusy&&<label className="pose-video-consent"><input type="checkbox" checked={recordConsent} onChange={event=>setRecordConsent(event.target.checked)}/><span><strong>내 움직임 영상도 남기기 (선택)</strong><small>측정 시작부터 최대 2분 · 소리 없음. 종료 후 별도로 보관하면 본인만 볼 수 있고 직접 삭제할 때까지 보관해요. 녹화가 끝나도 자세 측정은 계속돼요.</small></span></label>}
    {status==='running'&&recordState!=='idle'&&<p className="pose-record-state" role="status">{recordState==='recording'?'● 영상 녹화 중 · 처음 2분만 저장':recordState==='complete'?'영상 녹화 완료 · 자세 측정은 계속되고 있어요.':videoMessage}</p>}
    {status==='ready'&&selectionMode==='manual'&&<button ref={prepareButton} className="btn btn-primary pose-start-button" onClick={beginMeasurement}>5초 후 측정 시작</button>}
    <div className="pose-live-status" role="status" hidden={countdown!==null||aiBusy}>{selectionMode==='ai'&&!['loading','running','ended'].includes(status)?'동작과 방향이 확실할 때만 측정을 시작해요. 측정 중에는 사진을 계속 전송하지 않아요.':status==='loading'?'카메라와 자세 확인을 준비하고 있어요. 처음에는 잠시 걸릴 수 있어요.':status==='idle'?guide.setup:stats.message}</div>
    {status==='running'&&(guide.front?<div className="pose-observation-status"><span>정면 관찰</span><strong>{status==='ended'?'관찰 종료':feedback?.ready?'양쪽 무릎 비교 중':status==='running'?'기준 자세 확인 중':'촬영 준비'}</strong><p>시작 자세와 비교한 안쪽 이동을 확인해요.</p></div>:<div className="pose-metrics"><div><span>{exercise==='lunge'?'선택한 앞다리 반복':'이번 반복'}</span><strong>{stats.count}<small>회</small></strong></div></div>)}
    {status==='running'&&<><button className="btn pose-finish-button" autoFocus onClick={()=>stop()}>측정 종료하고 결과 보기</button><button className="btn btn-ghost pose-next-motion" onClick={()=>stop('다른 동작을 인식하기 전에 이번 결과를 확인하고 저장해 주세요.')}>다른 동작 인식</button><p className="pose-measurement-note">{guide.label} 기준으로 측정 중이에요. 동작을 바꾸면 새로 인식해 주세요.</p></>}
    {error&&<p className="pose-error" role="alert">{error}</p>}
    <div className="pose-controls">{!active?<><label>촬영 카메라<select value={facing} onChange={e=>setFacing(e.target.value)}><option value="user">전면 카메라</option><option value="environment">후면 카메라</option></select></label><button className="btn btn-primary" disabled={saveState==='saving'} onClick={()=>void start(status==='ended'?'ai':null)}>{status==='ended'?'새 동작 인식하기':'카메라 켜기'}</button></>:null}</div>
   </section>;
 const guidePanel=<aside className="pose-guide" hidden={status==='running'||status==='countdown'||countdown!==null||aiBusy}>
    <section className="pose-feedback" hidden={status!=='ended'} aria-label="자세 관찰 결과"><span className="pose-chip">자세 확인 · 참고용</span><h2>{status==='ended'?'이번 측정 돌아보기':'지금의 움직임'}</h2><small>{guide.label} · {guide.viewLabel}</small>{status==='ended'&&result&&result.owner===user?.id&&<div className="pose-result-summary"><strong>{guide.front?'정면 관찰 완료':`${stats.count}회 측정`}</strong><span>확인할 항목 {feedback?.items?.length||0}개</span><p>{result.payload.duration_seconds}초 관찰 · {saveState==='saved'?'내 계정에 저장했어요.':'아직 저장하지 않은 결과예요.'}</p><button className="btn btn-primary" disabled={saveState==='saving'||saveState==='saved'} onClick={saveResult}>{saveState==='saving'?'저장 중…':saveState==='saved'?'저장 완료':'결과 저장'}</button>{saveState==='saved'&&<p role="status">아래 지난 자세 측정에서 다시 볼 수 있어요.</p>}{saveError&&<p className="pose-error" role="alert">{saveError}</p>}{clip&&<div className="pose-video-box"><strong>이번 영상 · {Math.ceil(clip.durationSeconds)}초</strong><p>결과 저장 후 영상을 별도로 보관할 수 있어요.</p><button className="btn" disabled={saveState!=='saved'||uploadState==='saving'} onClick={storeVideo}>{uploadState==='saving'?'영상 보관 중…':'영상도 보관하기'}</button></div>}{videoMessage&&<p role="status">{videoMessage}</p>}</div>}<p>{feedback?.summary||guide.setup}</p>
     {feedback?.items?.map(item=>{const readout=['depth','angle'].includes(item.key);return <article key={item.key} data-state={readout?'steady':item.state}><div><strong>{item.label}</strong><span>{readout?'참고 수치':item.state==='observe'?'확인해 보세요':item.state==='steady'?'관찰 중':'판단 보류'}</span></div><p>{item.message}</p></article>;})}
     <p className="pose-limit">신호가 없다고 올바른 자세가 보장되지는 않아요. {guide.excludes}</p>
    </section>
    <div className="pose-preparation" hidden={status==='running'||status==='countdown'||countdown!==null||status==='ended'}><span className="pose-chip">시작 전 체크</span><h2>이렇게 준비해 주세요</h2><ol><li><strong>방향과 거리를 맞춰요</strong><p>{selectionMode==='ai'?'몸 전체와 발끝, 사용하는 기구를 화면에 담아 주세요. 스쿼트는 정면 또는 측면, 런지와 푸시업은 측면에서 준비해 주세요.':guide.framing} 밝은 곳에서 카메라를 수평으로 고정해 주세요.</p></li><li><strong>내 기준 자세부터</strong><p>{selectionMode==='ai'?'5초 준비 후 천천히 동작을 보여 주세요. 인식되면 3초 뒤 자동으로 측정을 시작해요.':guide.setup} 기준이 잡히면 안내에 따라 천천히 시작해요.</p></li><li><strong>편안한 범위 안에서</strong><p>횟수를 채우려고 더 깊게 움직이지 않아도 돼요. 통증이 있으면 중단하세요.</p></li></ol></div>
    <div className="pose-note"><strong>촬영 정보는 이렇게 사용해요</strong><p>동작 인식에 동의하고 시작할 때만 사진 4장을 CrewFit 서버를 거쳐 OpenAI로 전송해요. 이후 자세 측정과 직접 선택 측정은 기기에서 처리하며, 동작을 계속 촬영해 서버로 보내지는 않아요. 원본 이미지는 CrewFit에 저장하지 않으며, ‘결과 저장’을 누른 측정 요약을 내 계정에 보관해요. 선택한 무음 영상은 측정 시작부터 최대 2분만 녹화하며, 종료 후 별도 보관 버튼을 눌렀을 때 서버에 저장해 본인만 재생할 수 있으며 직접 삭제할 때까지 보관해요.</p></div>
    <p className="pose-limit">촬영 각도와 체형에 따라 오차가 있는 참고 결과예요. 통증이 있으면 중단하고 전문가와 상담해 주세요.</p>
   </aside>;
 return <div className={`pose-page ${active?'pose-active':''} ${status==='ended'?'pose-ended':''} ${status==='running'||countdown!==null||aiBusy?'pose-focused':''}`}>
  {guardDialog}
  <Link className="pose-back" to="/coach">← 코칭으로</Link>
  {!active&&<Link className="btn pose-manual-entry" to="/pose?view=manual">인식이 어렵나요? 운동 직접 찾기 · 이름 입력</Link>}
  {active&&<h1 className="pose-active-title">자세 측정 · {selectionMode==='ai'&&status!=='running'?'동작 자동 인식':guide.label}</h1>}
  <header className="pose-page-heading"><div><span className="section-eyebrow">자세 측정</span><h1>{status==='ended'?'내 움직임 돌아보기':'오늘의 움직임을 더 바르게'}</h1><p>{status==='ended'?'측정 결과를 확인하고, 다음 운동을 위해 남겨 보세요.':'카메라 준비 → 동작 자동 인식 → 자세 피드백 → 결과 저장'}</p></div><a className="pose-history-link" href="#pose-history-title">지난 측정 보기 ↗</a></header>
  {!active&&<Link className="pose-criteria-link" to="/pose?view=criteria">운동별 자세 기준 살펴보기 <span aria-hidden="true">↗</span></Link>}
  {status!=='ended'&&selectionPanel}
  <div className="pose-layout">
   {status==='ended'?<>{guidePanel}{studioPanel}</>:<>{studioPanel}{guidePanel}</>}
  </div>
  {status==='ended'&&selectionPanel}
  {!active&&<section className="pose-history" aria-labelledby="pose-history-title"><div className="pose-history-heading"><div><h2 id="pose-history-title">지난 자세 측정</h2><p>저장한 결과를 비교하며 변화를 살펴보세요.</p></div><button className="btn" disabled={history.isFetching} onClick={()=>history.refetch()}>{history.isFetching?'불러오는 중…':'새로고침'}</button></div>
   {history.isPending?<p role="status">저장한 결과를 불러오고 있어요.</p>:history.isError?<p className="pose-error" role="alert">{storageUnavailable(history.error)?'지금은 지난 결과를 불러올 수 없어요. 잠시 후 새로고침해 주세요.':'지난 결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}</p>:!history.data?.length?<div className="pose-history-empty">아직 저장한 측정이 없어요. 측정을 마치고 결과 저장을 눌러 주세요.</div>:<div className="pose-history-list">{history.data.map(row=><PoseHistoryCard key={row.id} row={row}/>)}</div>}
  </section>}
 </div>;
}
function PoseIllustration({exercise,front}){
 return <svg viewBox="0 0 160 160" aria-hidden="true">{front?<><circle cx="80" cy="25" r="12"/><path d="M80 40v40m-30-32h60M80 80l-25 30-10 35m35-65 25 30 10 35"/></>:exercise==='pushup'?<><circle cx="30" cy="60" r="12"/><path d="m43 65 57 20 40 15M50 70l-12 35 25 20m77-25 5 25"/></>:exercise==='lunge'?<><circle cx="80" cy="25" r="12"/><path d="M80 40 70 80 35 90 35 140m35-60 40 45 30 15M77 50l-30 15"/></>:<><circle cx="85" cy="25" r="13"/><path d="M80 45 65 80 97 108 70 145M67 77h43M70 145h25"/></>}</svg>;
}

function PoseHistoryCard({row}){
 const generic=row.view==='auto'||row.view==='manual';
 const guide=generic?{label:row.exercise_label||visionCriteria(row.exercise)?.label||'운동',viewLabel:row.view==='manual'?'이름·시간 기록':'사진 기반 관찰'}:getExerciseGuide(row.exercise,row.view);
 return <article className="pose-history-card"><div className="pose-history-heading"><div><time>{row.measured_on}</time><h3>{guide.label} <small>{guide.viewLabel}</small></h3></div><strong>{row.reps===null?(generic?'횟수 미측정':'정면 관찰'):`${row.reps}회`}</strong></div><p>{Math.floor(row.duration_seconds/60)>0?`${Math.floor(row.duration_seconds/60)}분 `:''}{row.duration_seconds%60}초 관찰</p>{row.observations?.length?<ul>{row.observations.map(item=><li key={item.key}><strong>{item.label}</strong><p>{item.message}</p></li>)}</ul>:<p>{generic?'저장된 자세 관찰 없음 · 올바른 자세라는 판정은 아니에요.':'지속된 확인 신호 없음 · 올바른 자세라는 판정은 아니에요.'}</p>}<small>촬영 조건에 영향을 받는 참고 결과예요.</small><PoseVideo sessionId={row.id}/></article>;
}
