import {useEffect,useRef} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import {changePoseConsent,poseConsentChangesKey,poseConsentQueryOptions,poseConsentState} from './poseConsentCache.js';

export function usePoseConsent(scope){
 const {user,token}=useAuth(),client=useQueryClient(),userId=user?.id;
 const auth=useRef({userId,token,scope}),mounted=useRef(true),write=useRef(null);
 auth.current={userId,token,scope};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;write.current?.abort();};},[]);
 useEffect(()=>()=>{write.current?.abort();write.current=null;},[userId,scope]);
 const query=useQuery(poseConsentQueryOptions({userId,scope,enabled:!!token,request:(path,options)=>api(path,{token,...options})}));
 // Shared across the preparation panel and settings: a failed revocation must
 // block both, even while the last confirmed server choice is still accepted.
 const changes=useQuery({queryKey:poseConsentChangesKey(userId),queryFn:async()=>({}),enabled:false});
 const stateFor=target=>poseConsentState({userId,scope:target,enabled:!!token,query,changes:changes.data});
 async function setAccepted(accepted,target=scope){
  if(write.current||!userId||!token)return false;
  const job=new AbortController(),owner=userId,startedScope=scope;write.current=job;
  const isCurrent=()=>mounted.current&&auth.current.userId===owner&&auth.current.scope===startedScope&&!job.signal.aborted;
  try{return await changePoseConsent(client,{userId:owner,scope:target,accepted,isCurrent,request:(path,options)=>api(path,{token:auth.current.token,signal:job.signal,...options})});}
  catch{return false;}
  finally{if(write.current===job)write.current=null;}
 }
 async function retry(target=scope){
  const change=client.getQueryData(poseConsentChangesKey(userId))?.[target];
  if(['error','unconfirmed'].includes(change?.status))return setAccepted(change.accepted,target);
  const owner=userId,startedScope=scope,result=await query.refetch();
  if(result.isSuccess&&mounted.current&&auth.current.userId===owner&&auth.current.scope===startedScope){
   return true;
  }
  return false;
 }
 async function retryAll(){
  const targets=['recognition','observation'],owner=userId;
  for(const target of targets){
   if(auth.current.userId!==owner)return false;
   const change=client.getQueryData(poseConsentChangesKey(owner))?.[target];
   if(['error','unconfirmed'].includes(change?.status)&&!await setAccepted(change.accepted,target))return false;
  }
  const result=await query.refetch();
  if(result.isSuccess&&mounted.current&&auth.current.userId===owner){
   return true;
  }
  return false;
 }
 return {...stateFor(scope),stateFor,queryError:query.isError?query.error?.message||'사진 분석 설정을 확인하지 못했어요.':'',
  retry,retryAll,grant:target=>setAccepted(true,target),revoke:target=>setAccepted(false,target)};
}
