import {useEffect,useRef,useState} from 'react';
import {useAuth} from './AuthContext.jsx';
import {api} from '../../shared/api.js';
import {verifyCalendarConnection} from './calendarConnection.js';
import {Capacitor} from '@capacitor/core';
export function useCalendarStatus(){
 const {session,calendarIssue,invalidateCalendarProvider}=useAuth(),[state,setState]=useState({connected:false,checking:false,message:''}),[attempt,setAttempt]=useState(0);
 const latest=useRef({session,invalidateCalendarProvider});latest.current={session,invalidateCalendarProvider};
 const owner=session?.user?.id,provider=session?.provider_token,native=Capacitor.isNativePlatform();
 useEffect(()=>{
  if(native||!provider){setState({connected:false,checking:false,message:native?'앱에서는 웹을 열어 연결과 일정 추가를 진행해요.':calendarIssue||'구글 캘린더 연결이 필요해요.'});return;}
  let active=true;setState({connected:false,checking:true,message:''});
  const checked=latest.current.session;
  verifyCalendarConnection(api,checked).then(result=>{if(active)setState({connected:result.connected===true,checking:false,message:result.connected?'구글 캘린더 연결을 확인했어요.':result.reason||'연결을 확인해 주세요.'});}).catch(error=>{if(active){if(['calendar_reconnect','calendar_permission','calendar_account_mismatch'].includes(error.code))latest.current.invalidateCalendarProvider(checked.user.id,checked.provider_token,error.message);setState({connected:false,checking:false,message:error.message});}});
  return()=>{active=false;};
 },[owner,provider,native,attempt,calendarIssue]);
 return {...state,recheck:()=>setAttempt(value=>value+1)};
}
