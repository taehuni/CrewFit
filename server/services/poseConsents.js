import {POSE_CONSENT_VERSION,POSE_CONSENT_SCOPES,hasPoseConsent} from '../../shared/poseConsent.js';
const failure=(status,code,message)=>Object.assign(new Error(message),{status,code});
function check(error){if(error)throw failure(503,'consent_unavailable','사진 분석 설정을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');}
function validate(body){
  if(!POSE_CONSENT_SCOPES.includes(body?.scope)||body?.version!==POSE_CONSENT_VERSION)throw failure(400,'consent_version','변경된 사진 분석 안내를 확인해 주세요.');
}
export function createPoseConsents({now=()=>new Date().toISOString()}={}){
 return {
  async list(db,userId){const {data,error}=await db.from('pose_analysis_consents').select('scope,version,accepted_at,revoked_at').eq('user_id',userId);check(error);return {consents:data||[],version:POSE_CONSENT_VERSION};},
  async set(db,userId,body){
   validate(body);if(typeof body.accepted!=='boolean')throw failure(400,'invalid_consent','분석 사용 여부를 선택해 주세요.');
   if(body.accepted){const {error}=await db.from('pose_analysis_consents').upsert({user_id:userId,scope:body.scope,version:POSE_CONSENT_VERSION,accepted_at:now(),revoked_at:null},{onConflict:'user_id,scope,version'});check(error);}
   else {const {error}=await db.from('pose_analysis_consents').update({revoked_at:now()}).eq('user_id',userId).eq('scope',body.scope).eq('version',POSE_CONSENT_VERSION);check(error);}
   return this.list(db,userId);
  },
  async require(db,userId,scope){const state=await this.list(db,userId);if(!hasPoseConsent(state.consents,scope))throw failure(403,'consent_required','사진 분석 사용 설정을 확인한 뒤 다시 시작해 주세요.');}
 };
}
