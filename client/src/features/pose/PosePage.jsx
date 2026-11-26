import PoseVisionMeasurement from './PoseVisionMeasurement.jsx';
import PoseConsentPanel from './PoseConsentPanel.jsx';
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
import {createPoseCalibration} from './poseCalibration.js';
import {poseRoute} from './poseRoute.js';
import {requestPoseCamera,attachPoseCamera,watchPoseCameraVisibility,poseCameraError} from './poseCamera.js';
import './pose.css';


const MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const INITIAL={count:0,angle:null,message:'카메라를 켜고 측면으로 서 주세요.'};
const storageUnavailable=error=>['42P01','PGRST205'].includes(error?.code);
export default function PosePage(){
 const {search,hash}=useLocation();
 const {user}=useAuth();
 const [pickerFilter,setPickerFilter]=useState({owner:user?.id,search:'',region:'all'});
 const currentFilter=pickerFilter.owner===user?.id?pickerFilter:{search:'',region:'all'};
 const updatePickerFilter=next=>setPickerFilter({owner:user?.id,...next});
 const route=poseRoute(search,hash);
 return route==='criteria'?<ExerciseCriteriaPanel/>:route==='selection'?<PoseVisionMeasurement key={`${user?.id}:${search}`} pickerFilter={currentFilter} onPickerFilterChange={updatePickerFilter}/>:<PoseMeasurement key={`${user?.id}:${search}:${route}`} historyOnly={route==='history'}/>;
}
function PoseMeasurement({historyOnly=false}){
 const {user,token}=useAuth(),queryClient=useQueryClient();
 const latestToken=useRef(token);latestToken.current=token;
 const location=useLocation();
 const currentOwner=useRef(user?.id);currentOwner.current=user?.id;
 const measurement=useRef(null),savingLock=useRef(false);
 const recorder=useRef(null),videoJob=useRef(null);
 const [recordConsent,setRecordConsent]=useState(false),[clip,setClip]=useState(null),[recordState,setRecordState]=useState('idle'),[videoMessage,setVideoMessage]=useState(''),[uploadState,setUploadState]=useState('idle');
 const latestRecordConsent=useRef(recordConsent);latestRecordConsent.current=recordConsent;
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
 const video=useRef(null),canvas=useRef(null),session=useRef(null),generation=useRef(0),counter=useRef(createRepCounter()),measuring=useRef(false),trackedSide=useRef(null);
 const initialExercise=new URLSearchParams(location.search).get('exercise');
 const initialLocal=Object.hasOwn(EXERCISE_GUIDES,initialExercise)?initialExercise:'squat';
 const initialView=EXERCISE_GUIDES[initialLocal].views[0].id;
 const initialMode=new URLSearchParams(location.search).get('view')==='auto'?'ai':'manual';
 const [exercise,setExercise]=useState(initialLocal),[view,setView]=useState(initialView);
 const [selectionMode,setSelectionMode]=useState(initialMode);
 const selection=useRef({exercise:initialLocal,view:initialView}),mode=useRef(initialMode);
 const [aiState,setAiState]=useState('idle'),[aiProgress,setAiProgress]=useState(0),[aiResult,setAiResult]=useState(null),[aiError,setAiError]=useState('');
 const aiJob=useRef(null),preparation=useRef(null),calibration=useRef(null),prepareButton=useRef(null);
 const [countdown,setCountdown]=useState(null),[calibrating,setCalibrating]=useState(false),[preparationDelayed,setPreparationDelayed]=useState(false);
 function cancelPreparation(){const job=preparation.current;preparation.current=null;calibration.current=null;job?.abort();setCountdown(null);setCalibrating(false);}
 function cancelCountdown(){cancelPreparation();cancelAi();setStatus('ready');requestAnimationFrame(()=>prepareButton.current?.focus());}
 function cancelAi(){if(aiJob.current)cancelPreparation();const job=aiJob.current;aiJob.current=null;job?.abort();setAiState('idle');setAiResult(null);setAiError('');}
 async function classifyAi(){
  if(!latestToken.current||!user?.id||!session.current||status!=='ready'||mode.current!=='ai'||aiJob.current||document.hidden)return;
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
   const response=await api('/pose/classify',{token:latestToken.current,body:{consent:true,frames},signal:job.signal});
   if(!current()||job.signal.aborted)return;
   if(!response||typeof response.label!=='string'||typeof response.reason!=='string')throw new Error('분석 결과를 확인하지 못했어요. 다시 시도하거나 직접 선택해 주세요.');
   setAiResult(response);clearTimeout(timeout);frames.length=0;
   const chosen=supportedAiSelection(response);
   if(!chosen){setAiState('done');return;}
   applySelection(chosen);prepareCalibration(chosen,owner);setAiState('done');
  }catch(err){if(current()){setAiState('idle');setStatus('ready');setAiError(timedOut?'분석 시간이 길어져 중단했어요. 다시 시도하거나 직접 선택해 주세요.':err.name==='AbortError'?'':err.message||'분석하지 못했어요. 직접 운동을 선택할 수 있어요.');}}
  finally{clearTimeout(timeout);frames.length=0;if(current()){preparation.current=null;setCountdown(null);aiJob.current=null;}}
 }
 const guide=getExerciseGuide(exercise,view);
 function applySelection(next){trackedSide.current=null;selection.current=next;setExercise(next.exercise);setView(next.view);}
 const feedbackEngine=useRef(createExerciseFeedback('squat','side')),calibrationGate=useRef(createPoseCalibration({counter:counter.current})),observations=useRef(new Map());
 const [feedback,setFeedback]=useState(null);
 const [status,setStatus]=useState('idle'),[stats,setStats]=useState(INITIAL),[error,setError]=useState(''),[facing,setFacing]=useState('user');
 useEffect(()=>{setPreparationDelayed(false);if(status!=='calibrating')return;const timer=setTimeout(()=>setPreparationDelayed(true),12000);return()=>clearTimeout(timer);},[status]);
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
  prepareCalibration(chosen,owner);
 }
 function prepareCalibration(chosen,owner){
  const chosenGuide=getExerciseGuide(chosen.exercise,chosen.view);
  trackedSide.current=null;
  counter.current.reset();feedbackEngine.current=createExerciseFeedback(chosen.exercise,chosen.view);observations.current.clear();setFeedback(null);setStats({...INITIAL,message:'기준 자세를 확인하고 있어요.'});
  calibrationGate.current=createPoseCalibration({front:chosenGuide.front,counter:counter.current});
  calibration.current={chosen,owner,generation:generation.current};setCalibrating(true);setStatus('calibrating');
 }
 function activateMeasurement(chosen,owner){
  const chosenGuide=getExerciseGuide(chosen.exercise,chosen.view);
  calibration.current=null;setCalibrating(false);
  measurement.current={id:crypto.randomUUID(),owner,day:poseToday(),exercise:chosen.exercise,view:chosen.view,front:chosenGuide.front,started:Date.now(),validFrames:0,count:0};
  measuring.current=true;setStatus('running');
  if(latestRecordConsent.current){const id=measurement.current.id;try{recorder.current=createPoseVideoRecorder({stream:session.current.stream,onStatus:state=>{if(currentOwner.current===owner&&measurement.current?.id===id)setRecordState(state);},onComplete:recording=>{if(currentOwner.current===owner&&measurement.current?.id===id)setClip({...recording,id});},onError:error=>{if(currentOwner.current===owner&&measurement.current?.id===id){setRecordState('error');setVideoMessage(error.message);}}});}catch(error){setRecordState('error');setVideoMessage(error.message);}}
  setRecordConsent(false);
 }
 async function saveResult(){
  if(!result||result.owner!==user?.id||savingLock.current||saveState==='saved')return;
  savingLock.current=true;setSaveState('saving');setSaveError('');
  try{await savePoseSession(result.payload,{expectedUserId:result.owner});if(currentOwner.current!==result.owner)return;setSaveState('saved');await queryClient.invalidateQueries({queryKey:['pose-sessions',result.owner]});}
  catch(error){if(currentOwner.current!==result.owner)return;setSaveState('error');setSaveError(storageUnavailable(error)?'지금은 결과를 저장할 수 없어요. 잠시 후 다시 시도해 주세요.':'저장하지 못했어요. 연결을 확인한 뒤 다시 눌러 주세요. 같은 결과는 중복 저장되지 않아요.');}
  finally{savingLock.current=false;}
 }
 useEffect(()=>{const remove=watchPoseCameraVisibility({getSession:()=>session.current,onHidden:()=>stop('화면을 벗어나 카메라를 껐어요. 다시 시작할 수 있어요.')});return()=>{remove();measurement.current=null;videoJob.current?.abort();dispose();};},[]);
 useEffect(()=>{clearRecording();dispose();measurement.current=null;setResult(null);setFeedback(null);setStats(INITIAL);setStatus('idle');setSaveState('idle');setSaveError('');},[user?.id]);
 function canReplaceResult(){
  if(clip&&uploadState!=='saved'&&!window.confirm('아직 보관하지 않은 영상이 있어요. 영상을 지우고 계속할까요?'))return false;
  return !result||saveState==='saved'||window.confirm('아직 저장하지 않은 측정 결과가 있어요. 이 결과를 지우고 계속할까요?');
 }
 async function start(nextMode=null){
  if(session.current||savingLock.current||videoJob.current||!canReplaceResult())return;
  if(nextMode){mode.current=nextMode;setSelectionMode(nextMode);}
  trackedSide.current=null;
  clearRecording();measurement.current=null;setResult(null);setSaveState('idle');setSaveError('');
  dispose();counter.current.reset();feedbackEngine.current=createExerciseFeedback(exercise,view);feedbackEngine.current.reset();observations.current.clear();setFeedback(null);setStats(INITIAL);setError('');
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setError('이 주소에서는 카메라를 켤 수 없어요. CrewFit의 보안 연결(https) 주소로 다시 접속해 주세요.');return;}
  const id=generation.current,s={stream:null,model:null,frame:0};session.current=s;setStatus('loading');let cameraReady=false,modelTimeout=null;
  try{
   s.stream=await requestPoseCamera({facing,width:exercise==='pushup'?640:480,height:exercise==='pushup'?480:640});
   if(id!==generation.current){s.stream.getTracks().forEach(t=>t.stop());return;}
   s.stream.getVideoTracks().forEach(t=>{t.onended=()=>{if(id===generation.current)stop('카메라 연결이 종료됐어요. 다시 연결해 주세요.');};});
   if(!await attachPoseCamera(s.stream,video.current,{isCurrent:()=>id===generation.current}))return;
   s.previewReady=true;cameraReady=true;
   modelTimeout=setTimeout(()=>{if(id!==generation.current||s.model)return;dispose();setStatus('idle');setError('카메라는 연결됐지만 자세 분석 준비가 오래 걸려 중단했어요. 인터넷 연결을 확인하고 다시 켜거나 운동 직접 찾기를 이용해 주세요.');},30000);
   const {FilesetResolver,PoseLandmarker}=await import('@mediapipe/tasks-vision');
   if(id!==generation.current)return;
   const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm');
   if(id!==generation.current)return;
   const model=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:MODEL},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.65,minPosePresenceConfidence:.65,minTrackingConfidence:.65});
   if(id!==generation.current){model.close();return;}clearTimeout(modelTimeout);s.model=model;setStatus('ready');
   let last=0,lastVideo=-1;
   function tick(now){
    if(id!==generation.current)return;
    try{const v=video.current,c=canvas.current;
     if(v?.readyState>=2&&now-last>=120&&v.currentTime!==lastVideo){last=now;lastVideo=v.currentTime;c.width=v.videoWidth;c.height=v.videoHeight;
      if(mode.current==='ai'&&!measuring.current&&!calibration.current){c.getContext('2d').clearRect(0,0,c.width,c.height);s.frame=requestAnimationFrame(tick);return;}
      const result=model.detectForVideo(v,now);
      const chosen=selection.current,currentGuide=getExerciseGuide(chosen.exercise,chosen.view);
      const pose=analyzeExercise(result.landmarks?.[0],v.videoWidth,v.videoHeight,chosen.exercise,chosen.view,trackedSide.current),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
      if(pose.valid)trackedSide.current=pose.side;
      if(pose.valid){const points=Object.values(pose.points);ctx.strokeStyle='#b8f575';ctx.fillStyle='#b8f575';ctx.lineWidth=5;
       const segments=pose.segments||[['shoulder','hip'],['hip','knee'],['knee','ankle']];
       for(const [a,b] of segments){const from=pose.points[a],to=pose.points[b];if(!from||!to)continue;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();}
       points.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill();});}

      let currentFeedback=null,tracking={ready:false,rep:{count:0,phase:'waiting'}};
      const preparing=calibration.current;
      if(measuring.current||preparing){
       currentFeedback=feedbackEngine.current.update(pose,result.landmarks?.[0],v.videoWidth,v.videoHeight,now);
       tracking=calibrationGate.current.update({pose,feedback:currentFeedback,time:now});
       setFeedback(currentFeedback);setCalibrating(!tracking.ready);
       if(preparing&&tracking.ready&&preparing.owner===currentOwner.current&&preparing.generation===generation.current&&!document.hidden)activateMeasurement(preparing.chosen,preparing.owner);
       if(measuring.current&&tracking.ready)currentFeedback.items.filter(item=>item.state==='observe'&&!['depth','angle'].includes(item.key)).forEach(item=>observations.current.set(item.key,item));
      }
      const {rep}=tracking;
      if(measuring.current&&measurement.current){measurement.current.count=rep.count;if(tracking.ready)measurement.current.validFrames++;}
      setStats({count:rep.count,angle:pose.valid&&Number.isFinite(pose.angle)?Math.round(pose.angle):null,message:(measuring.current||preparing)&&!tracking.ready?currentFeedback?.ready?'시작 자세를 조금 더 유지해 주세요. 준비가 끝나면 안내할게요.':currentFeedback?.summary:!pose.valid?pose.message:!measuring.current?'촬영 위치를 확인한 뒤 측정을 시작하세요.':preparing?'준비가 끝났어요. 이제 천천히 운동을 시작해 주세요.':currentFeedback?.items.find(item=>item.state==='observe'&&!['depth','angle'].includes(item.key))?.message|| (currentGuide.front?'양쪽 무릎의 움직임을 관찰하고 있어요.':rep.phase==='down'?'편안한 속도로 시작 자세로 돌아오세요.':'천천히 움직여 주세요. 무리해서 각도를 만들지 마세요.')});
     }s.frame=requestAnimationFrame(tick);
    }catch{stop('분석이 중단됐어요. 카메라를 다시 켜 주세요.');setError('이 기기에서 자세 분석을 계속할 수 없어요. 다른 브라우저로 다시 시도해 주세요.');}
   }s.frame=requestAnimationFrame(tick);
  }catch(err){if(id!==generation.current)return;dispose();setStatus('idle');setError(cameraReady?'카메라는 연결됐지만 자세 분석을 준비하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.':poseCameraError(err));}
  finally{clearTimeout(modelTimeout);}
 }
 const active=['loading','ready','countdown','calibrating','running'].includes(status);
 const aiBusy=['countdown','capturing','analyzing'].includes(aiState);
 const liveObservation=feedback?.ready?feedback.items.find(item=>item.state==='observe'&&!['depth','angle'].includes(item.key)):null;
 const guardDialog=useLeaveGuard(active||Boolean(clip)||Boolean(result&&saveState!=='saved'), active?'화면을 나가면 카메라가 꺼지고 이번 측정은 저장되지 않아요. 나갈까요?':'아직 보관하지 않은 측정 결과 또는 영상이 있어요. 저장하지 않고 나갈까요?');
 useEffect(()=>{if(!active)return;const lock=createPoseScreenLock(navigator.wakeLock);void lock.start();return()=>{void lock.stop();};},[active]);
 function changeMode(nextExercise,nextView){
  if(measuring.current||preparation.current||calibration.current||status==='loading'||savingLock.current||(nextExercise===exercise&&nextView===view)||!canReplaceResult())return;clearRecording();measurement.current=null;cancelAi();setResult(null);setSaveState('idle');setSaveError('');applySelection({exercise:nextExercise,view:nextView});if(status!=='ready')setStatus('idle');setStats(INITIAL);setFeedback(null);setError('');observations.current.clear();counter.current.reset();
 }
 function changeSelectionMode(next){
  if(measuring.current||preparation.current||calibration.current||status==='loading'||savingLock.current||!canReplaceResult())return;
  clearRecording();measurement.current=null;cancelAi();mode.current=next;setSelectionMode(next);setResult(null);setFeedback(null);setSaveState('idle');setSaveError('');if(status==='ended')setStatus('idle');
 }
 const modeControls=selectionMode==='ai'?<button type="button" className="btn btn-ghost" disabled={!!preparation.current} onClick={()=>changeSelectionMode('manual')}>직접 선택해서 측정</button>:null;
 const selectionPanel=selectionMode==='manual'?<section className="pose-selection" hidden={active} aria-label="직접 운동 선택">
   <div className="pose-section-label"><h2>{guide.scope}</h2><Link to="/pose">운동 바꾸기</Link></div>
   <div className="pose-direction"><strong>촬영 방향</strong><div role="group" aria-label="촬영 방향">{guide.views.map(v=><button key={v.id} type="button" disabled={active||saveState==='saving'} aria-pressed={view===v.id} onClick={()=>changeMode(exercise,v.id)}>{v.label}</button>)}</div></div>
   {guide.front&&<p className="pose-selection-caption">정면에서는 무릎 움직임만 확인해요. 횟수는 측면에서 측정해요.</p>}{modeControls}
  </section>:null;
 const aiPanel=<div className="pose-ai-panel">
  {aiResult&&!supportedAiSelection(aiResult)&&<div className="pose-ai-result" role="status"><strong>{classifiedVisionCriteria(aiResult)?'운동을 찾았어요 · 사진 관찰을 시작해 주세요':aiResult.label}</strong><p>{aiResult.reason}</p>{classifiedVisionCriteria(aiResult)?<Link className="btn btn-primary" to={`/pose?view=manual&exercise=${encodeURIComponent(aiResult.criteriaId)}`}>{aiResult.label} 관찰 시작하기</Link>:<p>이번에는 자세 측정을 시작하지 않았어요. 전신과 움직임이 보이게 다시 촬영하거나 직접 운동을 선택해 주세요.</p>}</div>}
  <PoseConsentPanel mode="recognition" startButtonRef={prepareButton}
   recordConsent={recordConsent} onRecordConsentChange={setRecordConsent} disabled={!!aiJob.current}
   onStart={classifyAi} startLabel={aiResult||aiError?'다시 인식하기':'자동 인식 시작'}>
   {aiError&&<p className="pose-error" role="alert">{aiError}</p>}
  </PoseConsentPanel>
  <div className="pose-ai-progress" role="status" aria-live="polite">{aiState==='capturing'?`천천히 동작을 보여 주세요 · ${aiProgress}/4장 촬영`:aiState==='analyzing'?'동작과 촬영 방향을 확인하고 있어요. 잠시 편하게 쉬어 주세요.':''}</div>
  <Link className="btn" to="/pose?view=manual">운동 직접 선택</Link>{modeControls}
 </div>;
 const studioPanel=<section key="camera" className="pose-studio" aria-label="카메라와 측정">
    <div className="pose-studio-heading"><div><strong>{selectionMode==='ai'&&!['calibrating','running','ended'].includes(status)?'동작 자동 인식':<>{guide.label} <small>{guide.viewLabel}</small></>}</strong></div><span className={`pose-state-badge ${status==='running'&&!calibrating?'is-running':''}`}>{calibrating?'기준 자세 확인':countdown!==null?'준비 중':status==='running'?'측정 중':status==='loading'?'연결 중':status==='ready'?'준비 완료':status==='ended'?'측정 종료':'시작 전'}</span></div>
    {!active&&selectionMode==='manual'&&<p className="pose-selected-method">{guide.front?'무릎 움직임 확인 · 횟수 미측정':guide.framing}</p>}
    {!active&&<div className="pose-camera-entry"><div className="pose-controls"><label>촬영 카메라<select value={facing} onChange={e=>setFacing(e.target.value)}><option value="user">전면 카메라</option><option value="environment">후면 카메라</option></select></label><button className="btn btn-primary" disabled={saveState==='saving'} onClick={()=>void start()}>{status==='ended'?(selectionMode==='ai'?'새 동작 찾아보기':'같은 운동 다시 측정'):'카메라 켜기'}</button></div></div>}
    {error&&!active&&<p className="pose-error" role="alert">{error}</p>}
    <div className={`pose-camera ${facing==='user'?'pose-mirror':''}`}>
     <video ref={video} muted playsInline/><canvas ref={canvas} aria-hidden="true"/>
     {active&&countdown===null&&status!=='running'&&<button className="pose-stop-overlay" onClick={()=>stop()} aria-label={status==='running'?'측정 종료하고 카메라 끄기':'카메라 끄기'}>■ {status==='running'?'측정 종료':'카메라 끄기'}</button>}
     {countdown!==null&&<div className="pose-countdown" role="status" aria-live="assertive" aria-atomic="true"><span>{selectionMode==='ai'?'동작 인식 준비':'측정 준비'}</span><strong>{countdown}</strong><p>화면에서 떨어져 몸 전체가 보이게 준비하세요.</p><button type="button" className="btn" autoFocus onClick={cancelCountdown}>준비 취소</button></div>}
     {selectionMode==='ai'&&['capturing','analyzing'].includes(aiState)&&<div className="pose-recognition-overlay" role="status" aria-live="polite"><strong>{aiState==='capturing'?'천천히 동작을 보여 주세요':'동작을 확인하고 있어요'}</strong><span>{aiState==='capturing'?`${aiProgress}/4장 촬영 · 몸 전체가 보이게`:'잠시 편하게 쉬어 주세요'}</span><button className="btn" type="button" onClick={cancelCountdown}>인식 취소</button></div>}
     {!active&&<div className="pose-placeholder"><PoseIllustration exercise={exercise} front={selectionMode==='ai'||guide.front}/><strong>{selectionMode==='ai'?'몸 전체와 기구가 보이게 준비해 주세요':guide.front?'정면에서 양쪽 다리가 보이게':exercise==='pushup'?'옆에서 몸 전체가 보이게':exercise==='lunge'?'옆에서 앞다리와 발끝이 보이게':'옆에서 몸과 발끝이 보이게'}</strong></div>}
    </div>
    {status==='ready'&&countdown===null&&!aiBusy&&<div className={selectionMode==='ai'?'pose-ai-preparation':'pose-ready-selection'}>{selectionMode==='ai'?aiPanel:<><div className="pose-ready-fields"><label>운동<select value={exercise} onChange={e=>changeMode(e.target.value,EXERCISE_GUIDES[e.target.value].views[0].id)}>{Object.entries(EXERCISE_GUIDES).map(([key,g])=><option key={key} value={key}>{g.label}</option>)}</select></label><label>촬영 방향<select value={view} onChange={e=>changeMode(exercise,e.target.value)}>{guide.views.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label><p>{guide.setup}</p></div>{modeControls}</>}</div>}
    {status==='ready'&&selectionMode==='manual'&&!aiBusy&&<PoseConsentPanel recordConsent={recordConsent} onRecordConsentChange={setRecordConsent} onStart={beginMeasurement} startButtonRef={prepareButton} startLabel="측정 시작"/>}
    {status==='running'&&recordState!=='idle'&&<p className="pose-record-state" role="status">{recordState==='recording'?'● 영상 녹화 중 · 처음 2분만 저장':recordState==='complete'?'영상 녹화 완료 · 자세 측정은 계속되고 있어요.':videoMessage}</p>}
    <div className="pose-live-status" role="status" hidden={countdown!==null||aiBusy||status==='idle'||status==='ready'||status==='ended'}>{calibrating?<><strong>{status==='running'?'기준 자세를 다시 확인해요':'시작 전 · 기준 자세를 확인해요'}</strong><p>{guide.setup}</p><span>{stats.message?.replace(/\s*기준(?: 자세)? 확인 \d+\/12$/,'')} {status==='running'?'확인하는 동안 횟수는 잠시 멈춰요.':'준비가 끝나면 자동으로 측정을 시작해요.'}</span></>:status==='running'?<><strong>{liveObservation?'확인해 보세요':'기준 자세 확인 완료 · 움직임 관찰 중'}</strong><p>{stats.message}</p></>:selectionMode==='ai'&&!['loading','ended'].includes(status)?'몸 전체와 기구가 보이게 준비해 주세요.':status==='loading'?'카메라와 자세 확인을 준비하고 있어요. 처음에는 잠시 걸릴 수 있어요.':stats.message}</div>
    {status==='calibrating'&&<>{preparationDelayed&&<p className="pose-error" role="status">기준 자세를 아직 확인하지 못했어요. 촬영 위치와 조명을 조정한 뒤 다시 준비해 주세요.</p>}<button className="btn pose-finish-button" autoFocus onClick={cancelCountdown}>{preparationDelayed?'촬영 위치 다시 맞추기':'준비 취소'}</button></>}
    {status==='running'&&(guide.front?<div className="pose-observation-status"><span>정면 관찰</span><strong>{status==='ended'?'관찰 종료':feedback?.ready?'양쪽 무릎 비교 중':status==='running'?'기준 자세 확인 중':'촬영 준비'}</strong></div>:<div className="pose-metrics"><div><span>{exercise==='lunge'?'선택한 앞다리 반복':'이번 반복'}</span><strong>{stats.count}<small>회</small></strong></div></div>)}
    {status==='running'&&<button className="btn pose-finish-button" autoFocus onClick={()=>stop()}>측정 종료하고 결과 보기</button>}
    {error&&active&&<p className="pose-error" role="alert">{error}</p>}
   </section>;
 const guidePanel=<aside key="guide" className="pose-guide" hidden={status==='running'||status==='calibrating'||status==='countdown'||countdown!==null||aiBusy}>
    <section className="pose-feedback" hidden={status!=='ended'} aria-label="자세 관찰 결과"><h2>측정 결과</h2><small>{guide.label} · {guide.viewLabel}</small>{status==='ended'&&result&&result.owner===user?.id&&<div className="pose-result-summary"><strong>{guide.front?'정면 관찰 완료':`${stats.count}회 측정`}</strong><p>{Math.floor(result.payload.duration_seconds/60)}분 {result.payload.duration_seconds%60}초</p><button className="btn btn-primary" disabled={saveState==='saving'||saveState==='saved'} onClick={saveResult}>{saveState==='saving'?'저장 중…':saveState==='saved'?'저장 완료':'결과 저장'}</button>{saveError&&<p className="pose-error" role="alert">{saveError}</p>}{clip&&<div className="pose-video-box"><strong>이번 영상 · {Math.ceil(clip.durationSeconds)}초</strong><p>결과 저장 후 영상을 별도로 보관할 수 있어요.</p><button className="btn" disabled={saveState!=='saved'||uploadState==='saving'} onClick={storeVideo}>{uploadState==='saving'?'영상 보관 중…':'영상도 보관하기'}</button></div>}{videoMessage&&<p role="status">{videoMessage}</p>}</div>}<p>{feedback?.summary||guide.setup}</p>
     {feedback?.items?.map(item=>{const readout=['depth','angle'].includes(item.key);return <article key={item.key} data-state={readout?'steady':item.state}><div><strong>{item.label}</strong><span>{readout?'참고 수치':item.state==='observe'?'확인해 보세요':item.state==='steady'?'관찰 중':'판단 보류'}</span></div><p>{item.message}</p></article>;})}
     <p className="pose-limit">신호가 없다고 올바른 자세가 보장되지는 않아요. {guide.excludes}</p>
    </section>
   </aside>;
 const HistoryHeading=historyOnly?'h1':'h2';
 const historyPanel=<section className="pose-history" aria-labelledby="pose-history-title"><div className="pose-history-heading"><div><HistoryHeading id="pose-history-title">지난 자세 측정</HistoryHeading></div><button className="btn" disabled={history.isFetching} onClick={()=>history.refetch()}>{history.isFetching?'불러오는 중…':'새로고침'}</button></div>
   {history.isPending?<p role="status">저장한 결과를 불러오고 있어요.</p>:history.isError?<p className="pose-error" role="alert">{storageUnavailable(history.error)?'지금은 지난 결과를 불러올 수 없어요. 잠시 후 새로고침해 주세요.':'지난 결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}</p>:!history.data?.length?<div className="pose-history-empty">저장한 측정이 없어요.</div>:<div className="pose-history-list">{history.data.map(row=><PoseHistoryCard key={row.id} row={row}/>)}</div>}
  </section>;
 if(historyOnly)return <div className="pose-page">{guardDialog}<Link className="pose-back" to="/pose">← 운동 선택으로</Link>{historyPanel}</div>;
 return <div className={`pose-page ${!active&&status!=='ended'?'pose-idle':''} ${active?'pose-active':''} ${status==='ready'?'pose-preparing':''} ${status==='ended'?'pose-ended':''} ${status==='running'||status==='calibrating'||countdown!==null||aiBusy?'pose-focused':''}`}>
  {guardDialog}
  <Link className="pose-back" to="/coach">← 코칭으로</Link>

  {active&&<h1 className="pose-active-title">자세 측정 · {selectionMode==='ai'&&!['calibrating','running'].includes(status)?'동작 자동 인식':guide.label}</h1>}
  <header className="pose-page-heading"><div><h1>{status==='ended'?'내 움직임 돌아보기':'자세 측정'}</h1></div><Link className="pose-history-link" to="/pose?view=history#pose-history-title">지난 측정 보기 ↗</Link></header>
  {!active&&<div className="pose-entry-links"><Link to="/pose">운동 선택으로</Link><Link to="/pose?view=criteria">운동별 측정 기준</Link></div>}
  {status!=='ended'&&selectionPanel}
  <div className={`pose-layout ${status!=='ended'?'pose-layout-single':''}`}>
   {status==='ended'?<>{guidePanel}{studioPanel}</>:studioPanel}
  </div>
  {!active&&<div className="pose-entry-settings"><Link to="/me/settings#profile-analysis">사진 분석 설정</Link></div>}
  {!active&&historyPanel}
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
