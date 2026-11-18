// A paused/stalled video must not keep a previously recommended pose startable.
export function isStartPoseFrameFresh(lastFrame,now){
 return Number.isFinite(lastFrame)&&Number.isFinite(now)&&now>=lastFrame&&now-lastFrame<=500;
}
