// Abortable preparation time shared by local measurement and AI capture.
export function waitForPoseCountdown({signal,onTick,seconds=5,schedule=setTimeout,cancel=clearTimeout}={}){
 return new Promise((resolve,reject)=>{
  let timer,remaining=seconds;
  const cleanup=()=>{cancel(timer);signal?.removeEventListener('abort',abort);};
  const abort=()=>{cleanup();reject(new DOMException('Preparation cancelled','AbortError'));};
  const tick=()=>{if(signal?.aborted){abort();return;}if(remaining===0){cleanup();resolve();return;}onTick?.(remaining--);timer=schedule(tick,1000);};
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});tick();
 });
}
