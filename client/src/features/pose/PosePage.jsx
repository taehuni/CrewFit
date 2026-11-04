import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router';
import {createRepCounter} from './poseAnalysis.js';
import {analyzeExercise,createExerciseFeedback} from './exerciseAnalysis.js';
import {EXERCISE_GUIDES,getExerciseGuide} from './exerciseGuides.js';
import './pose.css';


const MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const INITIAL={count:0,angle:null,message:'카메라를 켜고 측면으로 서 주세요.'};
export default function PosePage(){
 const video=useRef(null),canvas=useRef(null),session=useRef(null),generation=useRef(0),counter=useRef(createRepCounter()),measuring=useRef(false);
 const [exercise,setExercise]=useState('squat'),[view,setView]=useState('side');
 const guide=getExerciseGuide(exercise,view);
 const feedbackEngine=useRef(createExerciseFeedback('squat','side')),observations=useRef(new Map());
 const [feedback,setFeedback]=useState(null);
 const [status,setStatus]=useState('idle'),[stats,setStats]=useState(INITIAL),[error,setError]=useState(''),[facing,setFacing]=useState('user');
 function dispose(){generation.current++;measuring.current=false;const s=session.current;session.current=null;if(s){cancelAnimationFrame(s.frame);s.stream?.getTracks().forEach(t=>t.stop());s.model?.close();}if(video.current)video.current.srcObject=null;canvas.current?.getContext('2d').clearRect(0,0,canvas.current.width,canvas.current.height);}
 function stop(message='측정을 마쳤어요. 이번 관찰 결과는 이 화면에서만 확인할 수 있어요.'){if(measuring.current)setFeedback({ready:false,items:[...observations.current.values()],summary:observations.current.size?'이번 측정 중 지속해서 감지된 항목이에요. 다음 동작에서 확인해 보세요.':'이번 측정에서 지속된 확인 신호는 기록되지 않았어요. 인식이 부족했을 수도 있으므로 정상 자세라는 뜻은 아니에요.'});dispose();setStatus('ended');setStats(old=>({...old,angle:null,message}));}
 useEffect(()=>{const hide=()=>{if(document.hidden&&session.current)stop('화면을 벗어나 카메라를 껐어요. 다시 시작할 수 있어요.');};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);dispose();};},[]);
 async function start(){
  dispose();counter.current.reset();feedbackEngine.current=createExerciseFeedback(exercise,view);feedbackEngine.current.reset();observations.current.clear();setFeedback(null);setStats(INITIAL);setError('');
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setError('카메라는 HTTPS 주소 또는 이 컴퓨터의 localhost에서 사용할 수 있어요.');return;}
  const id=generation.current,s={stream:null,model:null,frame:0};session.current=s;setStatus('loading');
  try{
   s.stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:640},height:{ideal:480}}});
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
      const result=model.detectForVideo(v,now),pose=analyzeExercise(result.landmarks?.[0],v.videoWidth,v.videoHeight,exercise,view),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
      if(pose.valid){const points=Object.values(pose.points);ctx.strokeStyle='#b8f575';ctx.fillStyle='#b8f575';ctx.lineWidth=5;
       const segments=pose.segments||[['shoulder','hip'],['hip','knee'],['knee','ankle']];
       for(const [a,b] of segments){const from=pose.points[a],to=pose.points[b];if(!from||!to)continue;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();}
       points.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill();});}

      let currentFeedback=null;if(measuring.current){const next=feedbackEngine.current.update(pose,result.landmarks?.[0],v.videoWidth,v.videoHeight,now);next.items.filter(item=>item.state==='observe'&&!['depth','angle'].includes(item.key)).forEach(item=>observations.current.set(item.key,item));setFeedback(next);currentFeedback=next;}
      if(lastSide&&pose.side!==lastSide)counter.current.update(null,now);lastSide=pose.side;
      const rep=measuring.current&&!guide.front?counter.current.update(pose.valid&&currentFeedback?.ready?pose.angle:null,now):{count:0,phase:'waiting'};
      setStats({count:rep.count,angle:pose.valid&&Number.isFinite(pose.angle)?Math.round(pose.angle):null,message:measuring.current&&!currentFeedback?.ready?currentFeedback?.summary:!pose.valid?pose.message:!measuring.current?'촬영 위치를 확인한 뒤 측정을 시작하세요.':currentFeedback?.items.find(item=>item.state==='observe'&&!['depth','angle'].includes(item.key))?.message|| (guide.front?'양쪽 무릎의 움직임을 관찰하고 있어요.':rep.phase==='down'?'편안한 속도로 시작 자세로 돌아오세요.':'천천히 움직여 주세요. 무리해서 각도를 만들지 마세요.')});
     }s.frame=requestAnimationFrame(tick);
    }catch{stop('분석이 중단됐어요. 카메라를 다시 켜 주세요.');setError('이 기기에서 자세 분석을 계속할 수 없어요. 다른 브라우저로 다시 시도해 주세요.');}
   }s.frame=requestAnimationFrame(tick);
  }catch(err){if(id!==generation.current)return;dispose();setStatus('idle');setError(err.name==='NotAllowedError'?'카메라 권한이 필요해요. 브라우저의 사이트 권한에서 허용한 뒤 다시 시도해 주세요.':err.name==='NotFoundError'?'사용할 수 있는 카메라가 없어요. 카메라가 있는 기기에서 열어 주세요.':'카메라 또는 분석 모델을 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.');}
 }
 const active=['loading','ready','running'].includes(status);
 function changeMode(nextExercise,nextView){
  if(active)return;setExercise(nextExercise);setView(nextView);setStatus('idle');setStats(INITIAL);setFeedback(null);setError('');observations.current.clear();counter.current.reset();
 }
 return <div className="pose-page">
  <Link className="pose-back" to="/coach">← 코칭으로</Link>
  <header><span className="section-eyebrow">MOVE WITH AWARENESS</span><h1>운동 자세 확인</h1><p>운동과 촬영 방향에 맞춰, 내 움직임을 살펴봐요.</p></header>
  <section className="pose-selection" aria-label="운동과 촬영 방향">
   <div className="pose-exercise-options" role="group" aria-label="운동 선택">{Object.entries(EXERCISE_GUIDES).map(([key,g])=><button key={key} type="button" disabled={active} aria-pressed={exercise===key} onClick={()=>changeMode(key,g.views[0].id)}><strong>{g.label}</strong><span>{g.description}</span></button>)}</div>
   <div className="pose-direction"><strong>촬영 방향</strong><div role="group" aria-label="촬영 방향">{guide.views.map(v=><button key={v.id} type="button" disabled={active} aria-pressed={view===v.id} onClick={()=>changeMode(exercise,v.id)}>{v.label}</button>)}</div><small>{active?'카메라를 끄면 운동과 방향을 바꿀 수 있어요.':guide.scope}</small></div>
   <p className="pose-selection-caption">{guide.evaluates}{guide.front?' · 정면에서는 횟수와 깊이를 측정하지 않아요.':''}</p>
  </section>
  <div className="pose-layout">
   <section className="pose-studio" aria-label="카메라와 측정">
    <div className="pose-studio-heading"><strong>{guide.label}</strong><span>{guide.viewLabel}</span></div>
    <div className={`pose-camera ${facing==='user'?'pose-mirror':''}`}>
     <video ref={video} muted playsInline/><canvas ref={canvas} aria-hidden="true"/>
     {active&&<button className="pose-stop-overlay" onClick={()=>stop()} aria-label="측정 종료하고 카메라 끄기">■ 카메라 끄기</button>}
     {!active&&<div className="pose-placeholder"><PoseIllustration exercise={exercise} front={guide.front}/><strong>{guide.front?'정면에서 양쪽 다리가 보이게':exercise==='pushup'?'옆에서 몸 전체가 보이게':exercise==='lunge'?'옆에서 앞다리와 발끝이 보이게':'옆에서 몸과 발끝이 보이게'}</strong><span>{guide.viewLabel} · 카메라 고정</span></div>}
    </div>
    <div className="pose-live-status" role="status">{status==='loading'?'분석 모델을 준비하고 있어요. 처음에는 잠시 걸릴 수 있어요.':status==='idle'?guide.setup:stats.message}</div>
    {guide.front?<div className="pose-observation-status"><span>정면 관찰</span><strong>{status==='ended'?'관찰 종료':feedback?.ready?'양쪽 무릎 비교 중':status==='running'?'기준 자세 확인 중':'촬영 준비'}</strong><p>시작 자세와 비교한 안쪽 이동을 확인해요.</p></div>:<div className="pose-metrics"><div><span>{exercise==='lunge'?'선택한 앞다리 반복':'이번 반복'}</span><strong>{stats.count}<small>회</small></strong></div><div><span>{guide.metric} · 추정</span><strong>{stats.angle??'—'}<small>{stats.angle!==null?'°':''}</small></strong></div></div>}
    {error&&<p className="pose-error" role="alert">{error}</p>}
    <div className="pose-controls">{!active?<><label>촬영 카메라<select value={facing} onChange={e=>setFacing(e.target.value)}><option value="user">전면 카메라</option><option value="environment">후면 카메라</option></select></label><button className="btn btn-primary" onClick={start}>{status==='ended'?'다시 카메라 켜기':'카메라 켜기'}</button></>:<>{status==='ready'&&<button className="btn btn-primary" onClick={()=>{counter.current.reset();feedbackEngine.current.reset();observations.current.clear();setFeedback(null);measuring.current=true;setStatus('running');}}>기준 자세 확인 · 시작</button>}<button className="btn" onClick={()=>stop()}>{status==='loading'?'취소 · 카메라 끄기':'종료 · 카메라 끄기'}</button></>}</div>
   </section>
   <aside className="pose-guide">
    <section className="pose-feedback" aria-label="자세 관찰 결과"><span className="pose-chip">항목별 자세 피드백 · 검증 중</span><h2>{status==='ended'?'이번 측정 돌아보기':'지금의 움직임'}</h2><small>{guide.label} · {guide.viewLabel}</small><p>{feedback?.summary||guide.setup}</p>
     {feedback?.items?.map(item=>{const readout=['depth','angle'].includes(item.key);return <article key={item.key} data-state={readout?'steady':item.state}><div><strong>{item.label}</strong><span>{readout?'참고 수치':item.state==='observe'?'확인해 보세요':item.state==='steady'?'관찰 중':'판단 보류'}</span></div><p>{item.message}</p></article>;})}
     <p className="pose-limit">신호가 없다고 올바른 자세가 보장되지는 않아요. {guide.excludes}</p>
    </section>
    <h2>촬영 준비</h2><ol><li><strong>방향과 거리를 맞춰요</strong><p>{guide.framing} 밝은 곳에서 카메라를 수평으로 고정해 주세요.</p></li><li><strong>내 기준 자세부터</strong><p>{guide.setup} 기준이 잡히면 안내에 따라 천천히 시작해요.</p></li><li><strong>편안한 범위 안에서</strong><p>횟수를 채우려고 더 깊게 움직이지 않아도 돼요. 통증이 있으면 중단하세요.</p></li></ol>
    <div className="pose-note"><strong>영상은 기기 안에서만 분석해요</strong><p>영상과 측정 결과를 서버에 보내거나 저장하지 않아요. 처음 실행할 때 Google·jsDelivr에서 분석 파일을 내려받아요.</p></div>
    <p className="pose-limit">체형과 촬영 각도에 따라 오차가 있어요. 감지 수치는 검증 중인 자체 기준이며, 안전 판정이나 전문가 평가를 대신하지 않아요. 화면을 나가면 카메라가 꺼져요.</p>
    <div className="pose-sources"><strong>참고한 운동 원칙</strong><a href={guide.source[1]} target="_blank" rel="noreferrer">{guide.source[0]} ↗</a></div>
   </aside>
  </div>
 </div>;
}
function PoseIllustration({exercise,front}){
 return <svg viewBox="0 0 160 160" aria-hidden="true">{front?<><circle cx="80" cy="25" r="12"/><path d="M80 40v40m-30-32h60M80 80l-25 30-10 35m35-65 25 30 10 35"/></>:exercise==='pushup'?<><circle cx="30" cy="60" r="12"/><path d="m43 65 57 20 40 15M50 70l-12 35 25 20m77-25 5 25"/></>:exercise==='lunge'?<><circle cx="80" cy="25" r="12"/><path d="M80 40 70 80 35 90 35 140m35-60 40 45 30 15M77 50l-30 15"/></>:<><circle cx="85" cy="25" r="13"/><path d="M80 45 65 80 97 108 70 145M67 77h43M70 145h25"/></>}</svg>;
}
