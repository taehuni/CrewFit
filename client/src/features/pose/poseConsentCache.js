import {POSE_CONSENT_VERSION,POSE_CONSENT_SCOPES,poseConsentChoice} from '../../../../shared/poseConsent.js';

const pendingByClient = new WeakMap();
let nextChangeId = 0;
export const poseConsentKey = userId => ['pose-consents', userId];
export const poseConsentChangesKey = userId => ['pose-consent-changes', userId];

function confirmedState(data) {
  if (data?.version !== POSE_CONSENT_VERSION || !Array.isArray(data.consents) || data.consents.some(item =>
    !item || !POSE_CONSENT_SCOPES.includes(item.scope) || typeof item.version !== 'string' ||
    typeof item.accepted_at !== 'string' || !item.accepted_at || (item.revoked_at != null && typeof item.revoked_at !== 'string'))) {
    throw new Error('사진 분석 설정을 확인하지 못했어요. 다시 확인해 주세요.');
  }
  return data;
}

export function poseConsentQueryOptions({userId,scope,enabled,request}) {
  return {queryKey:poseConsentKey(userId),queryFn:async({signal})=>confirmedState(await request('/pose/consents',{signal})),
    enabled:Boolean(enabled&&POSE_CONSENT_SCOPES.includes(scope)&&userId),retry:false,staleTime:0};
}

// A remembered choice is not a confirmed current permission while a read or
// change is unresolved. Keep failures separate from the last confirmed data.
export function poseConsentState({userId,scope,enabled,query,changes={}}) {
  const lastChoice = poseConsentChoice(query.data?.consents,scope), change = changes?.[scope];
  let status;
  if (!userId || !enabled || !POSE_CONSENT_SCOPES.includes(scope)) status='unchecked';
  else if (change?.status === 'saving' || change?.status === 'revoking') status=change.status;
  else if (query.isFetching) status='checking';
  else if (change?.status === 'error' || change?.status === 'unconfirmed') status=change.status;
  else if (query.isError) status='error';
  else if (!query.isSuccess || !query.data) status='unchecked';
  else status=lastChoice;
  const changing=status==='saving'||status==='revoking', issue=status==='error'||status==='unconfirmed';
  const labels={unchecked:'아직 확인하지 않음',checking:'설정 확인 중…','not-granted':'아직 동의하지 않음',accepted:'동의함',revoked:'사용 중지됨',saving:'동의 저장 중…',revoking:'사용 중지 중…',unconfirmed:'변경 확인 필요',error:change?(change.accepted?'동의 저장 확인 필요':'중지 확인 필요'):'확인하지 못함'};
  return {status,lastChoice,accepted:status==='accepted',saving:changing,loading:status==='checking',
    label:labels[status],retryLabel:['error','unconfirmed'].includes(change?.status)?(change.accepted?'동의 저장 다시 시도':'사용 중지 다시 시도'):'다시 확인',
    ready:['accepted','not-granted','revoked'].includes(status),
    error:issue?(change?.error||query.error?.message||'사진 분석 설정을 확인하지 못했어요. 다시 확인해 주세요.'):''};
}

function updateChange(client,userId,scope,changeId,value) {
  const key=poseConsentChangesKey(userId);
  // Do not recreate an account cache cleared by sign-out/account switching.
  if (client.getQueryData(key)?.[scope]?.id !== changeId) return;
  client.setQueryData(key,previous=>{
    const next={...previous};
    if(value)next[scope]={...next[scope],...value};else delete next[scope];
    return next;
  });
}

// Each response contains both scopes. Serialize changes so a delayed response
// cannot restore another scope's revoked status in the shared account cache.
export function changePoseConsent(client,{userId,scope,accepted,request,isCurrent}) {
  if (!isCurrent() || !userId || !POSE_CONSENT_SCOPES.includes(scope)) return Promise.resolve(false);
  const changesKey=poseConsentChangesKey(userId),current=client.getQueryData(changesKey)?.[scope];
  if(current?.status==='saving'||current?.status==='revoking')return Promise.resolve(false);
  const changeId=++nextChangeId;
  client.setQueryData(changesKey,previous=>({...previous,[scope]:{id:changeId,status:accepted?'saving':'revoking',accepted}}));
  let pending = pendingByClient.get(client);
  if (!pending) { pending = new Map(); pendingByClient.set(client,pending); }
  const previous = pending.get(userId) || Promise.resolve();
  const task = previous.catch(()=>{}).then(async()=>{
    let requested=false,finished=false;
    try {
      if (!isCurrent()) return false;
      const queryKey = poseConsentKey(userId);
      await client.cancelQueries({queryKey,exact:true});
      if (!isCurrent()) return false;
      requested=true;
      const data = confirmedState(await request('/pose/consents',{method:'PUT',body:{scope,version:POSE_CONSENT_VERSION,accepted}}));
      if (!isCurrent()) return false;
      if((poseConsentChoice(data.consents,scope)==='accepted')!==accepted)throw new Error('설정 변경 결과를 확인하지 못했어요.');
      // A focus/reconnect refetch may have started while the write was pending.
      await client.cancelQueries({queryKey,exact:true});
      if (!isCurrent()) return false;
      client.setQueryData(queryKey,data);
      updateChange(client,userId,scope,changeId,null);finished=true;
      return true;
    } catch(error) {
      if(isCurrent()){
        updateChange(client,userId,scope,changeId,{status:'error',error:accepted?'동의 저장을 확인하지 못했어요. 다시 시도해 주세요.':'사용 중지 완료를 확인하지 못했어요. 다시 중지해 주세요.'});
        finished=true;
      }
      throw error;
    } finally {
      if(!finished)updateChange(client,userId,scope,changeId,requested?{status:'unconfirmed',error:accepted?'동의 저장 완료를 확인하지 못했어요. 다시 시도해 주세요.':'사용 중지 완료를 확인하지 못했어요. 다시 중지해 주세요.'}:null);
    }
  });
  pending.set(userId,task);
  const release = ()=>{if(pending.get(userId)===task)pending.delete(userId);};
  void task.then(release,release);
  return task;
}
