const VIEWS={squat:new Set(['side','front']),lunge:new Set(['left','right']),pushup:new Set(['side'])};
const matches=(a,b)=>a?.exercise===b?.exercise&&a?.view===b?.view;

/** Temporal gate only. Model confidence is not a calibrated probability or a safety score.
 * A locked result still needs any separate user confirmation required by the UI.
 */
export function createRecognitionGate({minFrames=6,minDurationMs=1000,minConfidence=.8,minMargin=.2}={}){
 if(!Number.isInteger(minFrames)||minFrames<1||!Number.isFinite(minDurationMs)||minDurationMs<0||!Number.isFinite(minConfidence)||minConfidence<0||minConfidence>1||!Number.isFinite(minMargin)||minMargin<0||minMargin>1)throw new TypeError('Invalid recognition gate thresholds');
 let candidate=null,locked=null,frames=0,startedAt=null,lastTime=null,ready=false;
 function clearCandidate(){candidate=null;frames=0;startedAt=null;ready=false;}
 function result(){return {state:locked?'locked':candidate?'candidate':'searching',selection:locked?{...locked}:candidate?{...candidate}:null,ready};}
 function accepted(value){return value&&Object.hasOwn(VIEWS,value.exercise)&&VIEWS[value.exercise].has(value.view)&&Number.isFinite(value.confidence)&&value.confidence>=minConfidence&&value.confidence<=1&&Number.isFinite(value.margin)&&value.margin>=minMargin&&value.margin<=1;}
 return {
  update(value,time){
   if(!Number.isFinite(time)||time<0){clearCandidate();lastTime=null;return result();}
   if(lastTime!==null&&(time<=lastTime||time-lastTime>700)){clearCandidate();lastTime=time;return result();}
   lastTime=time;
   if(!accepted(value)||(locked&&!matches(locked,value))){clearCandidate();return result();}
   const selection={exercise:value.exercise,view:value.view};
   if(!matches(candidate,selection)){candidate=selection;frames=1;startedAt=time;ready=false;}
   else frames++;
   if(frames>=minFrames&&time-startedAt>=minDurationMs){locked??={...selection};ready=true;}
   return result();
  },
  reset(){clearCandidate();locked=null;lastTime=null;return result();}
 };
}
