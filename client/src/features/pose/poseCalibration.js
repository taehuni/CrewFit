import {createRepCounter} from './poseAnalysis.js';

// Preserve the calibrated engine and the standing endpoint when measurement starts.
// A lost baseline clears only the in-progress repetition, never the completed count.
export function createPoseCalibration({front=false,counter=createRepCounter()}={}){
 let ready=false;
 return {update({pose,feedback,time}){
  if(!pose?.valid||!feedback?.ready){
   ready=false;
   return {ready,rep:counter.update(null,time)};
  }
  const rep=front?{count:0,phase:'waiting'}:counter.update(pose.angle,time);
  ready=front||ready||rep.phase==='standing';
  return {ready,rep};
 }};
}
