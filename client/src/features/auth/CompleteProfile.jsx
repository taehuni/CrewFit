import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from './AuthContext.jsx';
import {supabase} from '../../shared/supabaseClient.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {normalizeMemberName} from '../../shared/memberName.js';
import {profileInput} from '../profile/memberProfile.js';
import {Button,Field,FormMessage} from '../../shared/ui.jsx';
import AuthLayout from './AuthLayout.jsx';
export default function CompleteProfile({me}){
 const {user,signOut}=useAuth(),cache=useQueryClient(),lock=useRef(false);
 const [nickname,setNickname]=useState(me.profile.nickname||''),[name,setName]=useState(me.settings?.real_name||''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  const real_name=normalizeMemberName(name),input=profileInput({nickname,activity_visibility:me.profile.activity_visibility||'crew',show_crews:me.profile.show_crews??true});
  const p=await supabase.from('profiles').update({nickname:input.nickname}).eq('id',user.id).select('nickname').single();if(p.error||!p.data)throw Error('닉네임을 저장하지 못했어요. 다시 시도해 주세요.');
  const s=await supabase.from('user_settings').update({real_name}).eq('user_id',user.id).select('real_name').single();if(s.error||!s.data)throw Error('이름을 저장하지 못했어요. 입력한 내용을 확인하고 다시 시도해 주세요.');
  cache.setQueryData(queryKeys.me(user.id),{...me,profile:{...me.profile,nickname:p.data.nickname},settings:{...me.settings,real_name:s.data.real_name}});
 }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 return <AuthLayout heading="가입 마무리" title={<>나를 소개하고,<br/>함께 시작해요.</>} description="활동에 필요한 두 가지만 입력해 주세요. 관심 운동과 사진은 나중에 설정할 수 있어요."><form className="form" onSubmit={submit}><Field id="complete-nickname" label="닉네임 · 필수" autoComplete="nickname" minLength={2} maxLength={20} required value={nickname} disabled={busy} onChange={e=>setNickname(e.target.value)} hint="2~20자. 프로필과 게시물에 표시돼요."/><Field id="complete-name" label="이름 (실명) · 필수" autoComplete="name" maxLength={50} required value={name} disabled={busy} onChange={e=>setName(e.target.value)} hint="본인과 가입이 승인된 크루의 크루장만 볼 수 있어요."/><FormMessage>{error}</FormMessage><Button type="submit" disabled={busy}>{busy?'저장 중…':'저장하고 시작하기'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={signOut}>로그아웃</Button></form></AuthLayout>;
}
