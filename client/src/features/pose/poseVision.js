import {GYM_EXERCISE_CRITERIA} from './gymCriteria.js';
export function visionCriteria(id){return GYM_EXERCISE_CRITERIA.find(item=>item.id===id&&item.evaluationStatus==='reference-only'&&item.sources.length&&item.observable.length)||null;}
export function classifiedVisionCriteria(result){return result?.evaluationMode==='vision'?visionCriteria(result.criteriaId):null;}
export function createVisionGate(now=()=>Date.now()){
 let busy=false,next=-Infinity,paused=false;
 return {begin(){if(busy||paused||now()<next)return false;busy=true;return true;},end(){if(busy)next=now()+35000;busy=false;},pause(){paused=true;},resume(){paused=false;},remaining(){return Math.max(0,next-now());}};
}
export function retryableVisionError(error){
 // Never loop on provider setup/contract failures, even when their HTTP status is 502.
 if(['analysis_unavailable','analysis_invalid_response','not_configured','daily_limit','consent_required'].includes(error?.code))return false;
 return error?.code==='analysis_temporary_failure'||error?.code==='rate_limited'||error?.name==='AbortError'||error?.name==='TypeError';
}
export function createVisionRecovery({maxRetries=2}={}){
 let failures=0;
 return {
  failed(error){failures++;return {retry:retryableVisionError(error)&&failures<=maxRetries,failures};},
  reset(){failures=0;},
 };
}
