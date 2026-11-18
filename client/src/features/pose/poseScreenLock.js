// Best effort only: camera lifecycle owns start/stop, with no background retries.
export function createPoseScreenLock(wakeLock) {
 let active=false,generation=0,sentinel=null,pending=null;
 async function release(lock) {
  try { if(lock&&!lock.released)await lock.release(); } catch { /* A failed release must not block camera cleanup. */ }
 }
 function start() {
  if(active)return pending;
  active=true;
  const token=++generation;
  pending=Promise.resolve().then(async()=>{
   if(!active||token!==generation||typeof wakeLock?.request!=='function')return;
   try {
    const lock=await wakeLock.request('screen');
    if(!active||token!==generation){await release(lock);return;}
    sentinel=lock;
   } catch { /* Unsupported, denied, or hidden pages can still use the camera. */ }
  });
  return pending;
 }
 function stop() {
  active=false;generation++;
  const lock=sentinel;sentinel=null;
  return release(lock);
 }
 return {start,stop};
}
