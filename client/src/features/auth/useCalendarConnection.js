import {useRef,useState} from 'react';
import {useAuth} from './AuthContext.jsx';
import {supabase} from '../../shared/supabaseClient.js';
import {Capacitor} from '@capacitor/core';
export function useCalendarConnection(){
 const {user}=useAuth(),lock=useRef(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const native=Capacitor.isNativePlatform();
 async function connect(){
  if(native){
   if(lock.current)return;lock.current=true;setBusy(true);setError('');
   try{const {Browser}=await import('@capacitor/browser');await Browser.open({url:'https://crewfit-akvt.onrender.com/me/settings?calendar=settings#profile-connections'});}
   catch{setError('웹을 열지 못했어요. 연결 상태를 확인한 뒤 다시 눌러 주세요.');}
   finally{lock.current=false;setBusy(false);}return;
  }
  setError('');if(!user.identities?.some(i=>i.provider==='google')){setError('현재 계정은 구글 로그인과 연결되어 있지 않아요. 구글 로그인 계정에서 캘린더를 연결해 주세요.');return;}
  if(lock.current)return;lock.current=true;setBusy(true);
  try{sessionStorage.setItem('crewfit-calendar-connect',JSON.stringify({userId:user.id,at:Date.now()}));const redirect=new URL('/auth/google',location.origin);redirect.searchParams.set('calendar','1');
   const result=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect.href,scopes:'https://www.googleapis.com/auth/calendar.events.owned',queryParams:{prompt:'consent',login_hint:user.email||''}}});if(result.error)throw result.error;
  }catch{sessionStorage.removeItem('crewfit-calendar-connect');setError('캘린더 연결을 시작하지 못했어요. 다시 시도해 주세요.');}finally{lock.current=false;setBusy(false);}
 }
 return {connect,error,busy,native};
}
