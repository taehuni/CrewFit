import {normalizeMemberName} from '../../shared/memberName.js';
export function needsProfileCompletion(user,me){
 const google=user?.identities?.some(i=>i.provider==='google')||user?.app_metadata?.providers?.includes('google');
 if(!google)return false;
 const nickname=me?.profile?.nickname?.trim()||'';
 try{normalizeMemberName(me?.settings?.real_name);}catch{return true;}
 return nickname.length<2||nickname.length>20||/[\u0000-\u001f\u007f]/.test(nickname);
}
