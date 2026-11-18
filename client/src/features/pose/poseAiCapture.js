export const AI_FRAME_LIMIT=120*1024;
export function captureSize(width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('카메라 화면을 확인할 수 없어요.');
 const scale=Math.min(1,512/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export function validateCapturedFrame(frame){
 if(typeof frame!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(frame))throw new Error('카메라 이미지를 만들지 못했어요.');
 const data=frame.split(',')[1],bytes=data.length*3/4-(data.endsWith('==')?2:data.endsWith('=')?1:0);
 if(bytes>=AI_FRAME_LIMIT)throw new Error('촬영 이미지가 너무 커요. 배경을 단순하게 정리한 뒤 다시 시도해 주세요.');
 return frame;
}
export function waitForCapture(ms,signal){
 return new Promise((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('취소했어요.','AbortError'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 });
}
// Only called from the explicit, consented button. No camera audio is requested.
export async function capturePoseFrames(video,{signal,onProgress=()=>{},createCanvas=()=>document.createElement('canvas'),wait=waitForCapture,isHidden=()=>document.hidden,now=()=>performance.now()}={}){
 const frames=[],canvas=createCanvas();
 try{
  for(let index=0;index<4;index++){
   signal?.throwIfAborted();if(isHidden())throw new DOMException('화면을 벗어났어요.','AbortError');
   const previous=video.currentTime,deadline=now()+2500;
   if(index)await wait(950,signal);
   while(video.readyState<2||video.currentTime===previous){
    if(now()>deadline)throw new Error('카메라 화면이 멈췄어요. 카메라를 다시 켜 주세요.');
    if(isHidden())throw new DOMException('화면을 벗어났어요.','AbortError');
    await wait(50,signal);
   }
   signal?.throwIfAborted();if(isHidden())throw new DOMException('화면을 벗어났어요.','AbortError');
   const size=captureSize(video.videoWidth,video.videoHeight);canvas.width=size.width;canvas.height=size.height;
   const context=canvas.getContext('2d');if(!context)throw new Error('카메라 이미지를 만들지 못했어요.');
   context.drawImage(video,0,0,canvas.width,canvas.height);
   frames.push(validateCapturedFrame(canvas.toDataURL('image/jpeg',.65)));onProgress(index+1);
  }
  return frames;
 }catch(error){frames.length=0;throw error;}
 finally{canvas.width=0;canvas.height=0;}
}
export function supportedAiSelection(result){
 if(result?.supported!==true||!result.selection||result.selection.exercise!==result.exercise)return null;
 const views={squat:['front','side'],lunge:['left','right'],pushup:['side']};
 if(!Object.hasOwn(views,result.exercise)||!views[result.exercise].includes(result.selection.view))return null;
 return {exercise:result.exercise,view:result.selection.view};
}
