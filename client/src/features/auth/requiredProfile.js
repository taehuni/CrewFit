import {queryKeys} from '../../shared/queryKeys.js';

export const PROFILE_CHECK_TIMEOUT_MS=45_000;
const aborted=()=>Object.assign(new Error('가입 정보 확인을 중단했어요.'),{name:'AbortError'});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const optionalText=value=>value==null||typeof value==='string';

export function validateRequiredProfile(data){
 if(!record(data)||!record(data.profile)||!optionalText(data.profile.nickname)||(data.settings!=null&&!record(data.settings))||!optionalText(data.settings?.real_name))throw Object.assign(new Error('가입 정보를 확인하지 못했어요.'),{code:'profile_response_invalid'});
 return data;
}

// Race the transport as well as aborting it: a stalled bridge/fetch must not keep
// the protected route waiting, even when it ignores its cancellation signal.
export async function loadRequiredProfile(request,{token,signal,timeoutMs=PROFILE_CHECK_TIMEOUT_MS,schedule=setTimeout,cancel=clearTimeout}={}){
 if(signal?.aborted)throw aborted();
 const controller=new AbortController();
 let timer,onAbort;
 const interrupted=new Promise((resolve,reject)=>{
  onAbort=()=>{const error=aborted();controller.abort(error);reject(error);};
  signal?.addEventListener('abort',onAbort,{once:true});
  timer=schedule(()=>{const error=Object.assign(new Error('가입 정보 확인이 지연되고 있어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.'),{code:'profile_check_timeout'});controller.abort(error);reject(error);},timeoutMs);
 });
 try{
  const pending=Promise.resolve().then(()=>{
   if(controller.signal.aborted)throw controller.signal.reason||aborted();
   return request('/me',{token,signal:controller.signal});
  });
  return validateRequiredProfile(await Promise.race([pending,interrupted]));
 }finally{cancel(timer);signal?.removeEventListener('abort',onAbort);}
}

export function requiredProfileQuery(request,{userId,token,enabled=true}){
 return {queryKey:queryKeys.me(userId),queryFn:({signal})=>loadRequiredProfile(request,{token,signal}),select:validateRequiredProfile,enabled,retry:false,networkMode:'always'};
}

export function requiredProfileError(error){
 return error?.code==='profile_check_timeout'?'가입 정보 확인이 지연되고 있어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.':'가입 정보를 확인하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
}
