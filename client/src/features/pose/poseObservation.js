// Read credentials after capture, never from the interval's render closure.
export function validatePoseObservation(response,exercise){
 if(response?.exercise!==exercise||typeof response.matched!=='boolean'||!Array.isArray(response.observations)){
  throw Object.assign(new Error('관찰 결과를 확인하지 못했어요.'),{code:'analysis_invalid_response'});
 }
 return response;
}
export async function requestPoseObservation({capture,request,getToken,exercise,signal,isCurrent}){
 let frames=[];
 try{
  frames=await capture({signal});
  if(signal.aborted||!isCurrent())return null;
  const result=await request({token:getToken(),body:{consent:true,frames,exercise},signal});
  return signal.aborted||!isCurrent()?null:result;
 }finally{frames.length=0;}
}
