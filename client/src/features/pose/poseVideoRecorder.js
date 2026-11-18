export const POSE_VIDEO_MAX_BYTES=32*1024*1024;
export function createPoseVideoRecorder({stream,onComplete,onError,onStatus=()=>{},Recorder=globalThis.MediaRecorder,makeStream=tracks=>new MediaStream(tracks),now=()=>performance.now(),schedule=setTimeout,clear=clearTimeout,maxBytes=POSE_VIDEO_MAX_BYTES}){
 if(!Recorder)throw new Error('이 기기에서는 영상 보관을 지원하지 않아요. 자세 측정은 계속할 수 있어요.');
 const mimeType=['video/webm;codecs=vp8','video/webm','video/mp4'].find(type=>Recorder.isTypeSupported?.(type));
 if(!mimeType)throw new Error('이 브라우저에서는 영상 보관을 지원하지 않아요. 자세 측정은 계속할 수 있어요.');
 const recorder=new Recorder(makeStream(stream.getVideoTracks()),{mimeType,videoBitsPerSecond:750000});
 let chunks=[],bytes=0,discarded=false,finished=false,timer,stoppedAt=null;
 const started=now();
 const stop=()=>{if(stoppedAt===null)stoppedAt=now();clear(timer);if(recorder.state!=='inactive')recorder.stop();};
 const fail=message=>{if(discarded)return;discarded=true;chunks=[];stop();onError(new Error(message));};
 recorder.ondataavailable=event=>{if(discarded||!event.data?.size)return;bytes+=event.data.size;if(bytes>maxBytes){fail('영상 용량이 커서 보관하지 못했어요. 자세 측정과 결과 저장은 계속할 수 있어요.');return;}chunks.push(event.data);};
 recorder.onerror=()=>fail('녹화가 중단됐어요. 자세 측정과 결과 저장은 계속할 수 있어요.');
 recorder.onstop=()=>{clear(timer);if(discarded||finished)return;finished=true;const blob=new Blob(chunks,{type:mimeType.split(';')[0]});chunks=[];if(!blob.size){onError(new Error('녹화된 영상이 없어요. 측정 결과는 따로 저장할 수 있어요.'));return;}onComplete({blob,mimeType:blob.type,durationSeconds:Math.max(.001,Math.min(120,((stoppedAt??now())-started)/1000))});onStatus('complete');};
 recorder.start(1000);timer=schedule(stop,120000);onStatus('recording');
 return {stop,dispose(){discarded=true;chunks=[];stop();}};
}
