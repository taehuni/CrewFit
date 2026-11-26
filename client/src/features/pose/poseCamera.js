export async function requestPoseCamera({mediaDevices=globalThis.navigator?.mediaDevices,secure=globalThis.isSecureContext,facing='user',width=640,height=640}={}){
 if(!secure||!mediaDevices?.getUserMedia)throw Object.assign(new Error('Camera unavailable'),{code:'camera_unavailable'});
 try{return await mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:width},height:{ideal:height}}});}
 catch(error){
  // Some mobile camera drivers reject even preferred dimensions. Never retry a permission denial.
  if(error.name!=='OverconstrainedError')throw error;
  return mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing}}});
 }
}

export function stopPoseCamera(stream){stream?.getTracks().forEach(track=>track.stop());}

export async function attachPoseCamera(stream,video,{isCurrent,isHidden=()=>globalThis.document.hidden}){
 const usable=()=>{
  if(!isCurrent()){stopPoseCamera(stream);return false;}
  if(isHidden())throw Object.assign(new Error('Camera page hidden'),{code:'camera_hidden'});
  return true;
 };
 if(!usable())return false;
 if(!video)throw Object.assign(new Error('Camera preview unavailable'),{code:'camera_preview'});
 video.muted=true;video.playsInline=true;video.autoplay=true;video.srcObject=stream;
 await video.play();
 return usable();
}

// Permission sheets can temporarily hide an iPhone web app. Only stop an established preview.
export function watchPoseCameraVisibility({document:page=globalThis.document,getSession,onHidden}){
 const hide=()=>{if(page.hidden&&getSession()?.previewReady)onHidden();};
 page.addEventListener('visibilitychange',hide);
 return()=>page.removeEventListener('visibilitychange',hide);
}

export function poseCameraError(error){
 if(error?.code==='camera_unavailable')return '이 주소에서는 카메라를 켤 수 없어요. Safari 또는 Chrome에서 CrewFit의 보안 연결(https) 주소를 열어 주세요.';
 if(error?.code==='camera_hidden')return '카메라 준비 중 화면을 벗어났어요. 이 화면에서 카메라를 다시 켜 주세요.';
 if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return '카메라 사용이 허용되지 않았어요. 브라우저의 이 사이트 카메라 권한을 허용한 뒤 다시 시도해 주세요.';
 if(error?.name==='NotFoundError')return '사용할 수 있는 카메라를 찾지 못했어요. 카메라가 있는 기기에서 열어 주세요.';
 if(error?.name==='NotReadableError'||error?.name==='AbortError')return '다른 앱이 카메라를 사용 중이거나 연결이 중단됐어요. 다른 카메라 앱을 닫고 다시 시도해 주세요.';
 return '카메라 화면을 준비하지 못했어요. 브라우저를 다시 열거나 다른 카메라로 시도해 주세요.';
}
