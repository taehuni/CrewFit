import {useRef,useState} from 'react';
import {useAuth} from './AuthContext.jsx';
import {supabase} from '../../shared/supabaseClient.js';
import {Capacitor} from '@capacitor/core';
import {calendarRedirect,calendarAccountAccess} from './calendarConnection.js';
export function useCalendarConnection(){
 const {user}=useAuth(),lock=useRef(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const native=Capacitor.isNativePlatform();
 const {eligible,reason}=calendarAccountAccess(user);
 async function connect(){
  if(!eligible){setError(reason);return;}
  if(native){
   if(lock.current)return;lock.current=true;setBusy(true);setError('');
   try{const {Browser}=await import('@capacitor/browser');await Browser.open({url:'https://crewfit-akvt.onrender.com/me/settings?calendar=settings#profile-connections'});}
   catch{setError('웹을 열지 못했어요. 연결 상태를 확인한 뒤 다시 눌러 주세요.');}
   finally{lock.current=false;setBusy(false);}return;
  }
  setError('');
  if(lock.current)return;lock.current=true;setBusy(true);
  try{const at=Date.now();try{sessionStorage.setItem('crewfit-calendar-connect',JSON.stringify({userId:user.id,at}));}catch{/* URL context also supports storage-restricted browser returns. */}
   const result=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:calendarRedirect(location.origin,user.id,at),scopes:'https://www.googleapis.com/auth/calendar.events.owned',queryParams:{prompt:'consent',login_hint:user.email||''}}});if(result.error)throw result.error;
  }catch{try{sessionStorage.removeItem('crewfit-calendar-connect');}catch{}setError('캘린더 연결을 시작하지 못했어요. 다시 시도해 주세요.');}finally{lock.current=false;setBusy(false);}
 }
 return {connect,error,busy,native,eligible,reason};
}
