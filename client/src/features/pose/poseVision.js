import {GYM_EXERCISE_CRITERIA} from './gymCriteria.js';
export function visionCriteria(id){return GYM_EXERCISE_CRITERIA.find(item=>item.id===id&&item.evaluationStatus==='reference-only'&&item.sources.length&&item.observable.length)||null;}
export function classifiedVisionCriteria(result){return result?.evaluationMode==='vision'?visionCriteria(result.criteriaId):null;}
export function createVisionGate(now=()=>Date.now()){
 let busy=false,last=-Infinity,paused=false;
 return {begin(){if(busy||paused||now()-last<35000)return false;busy=true;last=now();return true;},end(){busy=false;},pause(){paused=true;},resume(){paused=false;},remaining(){return Math.max(0,35000-(now()-last));}};
}
