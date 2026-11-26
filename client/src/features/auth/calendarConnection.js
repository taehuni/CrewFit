export function calendarAccountAccess(user){
 const eligible=Boolean(user?.identities?.some(identity=>identity.provider==='google'));
 return {eligible,reason:eligible?'':'웹과 앱 모두 현재 CrewFit 계정에 Google 로그인 연결이 필요해요. 이 설정에서 기존 계정을 유지한 채 Google을 연결하는 기능은 아직 지원하지 않아요. 저장한 운동 계획은 계속 이용할 수 있어요.'};
}
export function validCalendarRequest(request,userId,now=Date.now()){
 return !!request && request.userId===userId && Number.isFinite(request.at) && now>=request.at && now-request.at<=900000;
}
export function calendarRedirect(origin,userId,now=Date.now()){
 const url=new URL('/auth/google',origin);
 url.searchParams.set('calendar','1');
 // Return context only, never credentials. iOS PWA may return in Safari where
 // the initiating sessionStorage does not exist. Actual session/Google owner
 // must still match this ID before the server verifies calendar permission.
 url.searchParams.set('calendar_user',userId);
 url.searchParams.set('calendar_at',String(now));
 return url.href;
}
export function calendarRequestFromUrl(href){
 const url=new URL(href),userId=url.searchParams.get('calendar_user'),time=url.searchParams.get('calendar_at');
 if(url.searchParams.get('calendar')!=='1'||(!url.searchParams.has('calendar_user')&&!url.searchParams.has('calendar_at')))return null;
 return {userId,at:time&&/^\d+$/.test(time)?Number(time):NaN};
}
export function calendarReturnRequest(stored,returned,userId,now=Date.now()){
 // Explicit URL context must match; do not silently fall back after tampering.
 const request=returned||stored;
 return validCalendarRequest(request,userId,now)?request:null;
}
export function calendarReturnProblem({calendar,authLink,stored,returned,session},now=Date.now()){
 if(session?.user?.id&&stored?.rejectedUserId===session.user.id)return stored.problem==='invalid_request'?'invalid_request':'account_mismatch';
 if(!calendar||!authLink.present||authLink.error||!session?.user?.id)return null;
 const request=returned||stored;
 if(request?.userId&&request.userId!==session.user.id)return 'account_mismatch';
 return validCalendarRequest(request,session.user.id,now)?null:'invalid_request';
}
export async function verifyCalendarConnection(api,session){
 if(!session?.provider_token)return {connected:false,reason:'구글 캘린더를 연결해 주세요.'};
 return api('/calendar/connection',{token:session.access_token,body:{providerToken:session.provider_token}});
}
