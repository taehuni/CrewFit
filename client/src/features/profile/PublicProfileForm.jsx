import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import { RECORD_VISIBILITY, savePublicProfile } from './memberProfile.js';
import './profile.css';

export default function PublicProfileForm({ userId, profile }) {
  const cache = useQueryClient(), lock = useRef(false);
  const [form, setForm] = useState(() => ({ nickname: profile.nickname, activity_visibility: profile.activity_visibility || 'crew', show_crews: profile.show_crews ?? true }));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  function change(key, value) { setForm(previous => ({ ...previous, [key]: value })); setError(''); setMessage(''); }
  async function submit(event) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const saved = await savePublicProfile(supabase, userId, form);
      cache.setQueryData(queryKeys.me(userId), me => me && ({ ...me, profile: { ...me.profile, ...saved } }));
      await Promise.all([
        cache.invalidateQueries({ queryKey: queryKeys.memberRoot(userId) }),
        cache.invalidateQueries({ queryKey: queryKeys.postsRoot(userId) }),
        cache.invalidateQueries({ queryKey: ['crewStats', userId] }),
      ]);
      setForm({ nickname: saved.nickname, activity_visibility: saved.activity_visibility, show_crews: saved.show_crews });
      setMessage('닉네임과 공개 설정을 저장했어요.');
    } catch (cause) { setError(cause.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="card stack profile-settings" aria-labelledby="public-profile-title">
    <h2 id="public-profile-title">닉네임과 공개 설정</h2>
    <form className="form" onSubmit={submit}>
      <Field id="profile-nickname" label="닉네임" value={form.nickname} maxLength={20} required disabled={busy} onChange={event => change('nickname', event.target.value)} />
      <label className="field">운동 기록 공개 범위<select value={form.activity_visibility} disabled={busy} onChange={event => change('activity_visibility', event.target.value)}>{Object.entries(RECORD_VISIBILITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <p className="muted">같은 크루원은 가입이 승인된 회원을 뜻해요. 이미 글에 첨부한 기록은 글의 공개 범위로도 공유됩니다. GPS 경로는 회원 페이지에 표시하지 않아요.</p>
      <label className="profile-checkbox"><input type="checkbox" checked={form.show_crews} disabled={busy} onChange={event => change('show_crews', event.target.checked)} />가입 크루를 다른 회원에게 공개</label>
      <p className="muted">끄더라도 같은 크루원은 함께 가입한 크루를 볼 수 있어요. 실명·지역·선호 요일은 공개 카드에 표시하지 않아요.</p>
      <FormMessage>{error}</FormMessage><FormMessage tone="ok">{message}</FormMessage>
      <Button type="submit" disabled={busy}>{busy ? '저장 중…' : '프로필 설정 저장'}</Button>
    </form>
    <Link to={`/users/${userId}`}>내 회원 페이지 보기</Link>
  </section>;
}
