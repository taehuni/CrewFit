import SportIcon from '../../shared/SportIcon.jsx';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS, LEVELS, DAYS, loadRegions } from '../crews/crews.js';
import { saveCrewPreferences } from './crewPreferences.js';
import '../crews/crews.css';

export default function CrewPreferencesForm({ userId, profile, settings }) {
  const cache = useQueryClient(), running = useRef(false);
  const [form, setForm] = useState({ interested_sports: settings?.interested_sports ?? (profile.main_sport ? [profile.main_sport] : []), level: profile.level || '',
    region_sido: settings?.region_sido || '', region_sigungu: settings?.region_sigungu || '', preferred_days: settings?.preferred_days || [] });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const regions = useQuery({queryKey:queryKeys.regions(userId), queryFn:()=>loadRegions(supabase), retry:false});
  const rows = regions.data || [];
  const change = (key, value) => { setForm(previous => ({...previous, [key]:value})); setMessage(''); setError(''); };
  async function submit(event) {
    event.preventDefault();
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try { await saveCrewPreferences(supabase, userId, form, rows); setMessage('관심 운동과 활동 지역을 저장했어요.'); }
    catch (cause) { setError(cause.message); }
    finally {
      await Promise.all([cache.invalidateQueries({queryKey:queryKeys.me(userId)}), cache.invalidateQueries({queryKey:queryKeys.crewMatches(userId)})]);
      running.current = false; setBusy(false);
    }
  }
  return <section id="crew-preferences" className="card stack" aria-labelledby="crew-preferences-title">
    <h2 id="crew-preferences-title">관심 운동과 활동 지역</h2>
    <p className="crew-form-note">해보고 싶거나 좋아하는 운동을 여러 개 골라 주세요. 아직 정하지 않았다면 선택하지 않아도 괜찮아요. 관심 운동·지역·요일은 비공개이며 크루 추천에 사용해요.</p>
    {regions.isPending && <p role="status">지역 목록을 불러오고 있어요.</p>}
    {regions.isError && <div role="alert"><p>지역 목록을 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={() => regions.refetch()}>다시 조회</button></div>}
    <form className="crew-form" onSubmit={submit}><fieldset disabled={busy || !regions.isSuccess}>
      <div className="crew-form-pair">
        <fieldset className="interest-sports"><legend>관심 운동 · 여러 개 선택 가능</legend>{Object.entries(SPORTS).map(([value,label])=><label key={value} className={form.interested_sports.includes(value)?"selected":""}><input type="checkbox" checked={form.interested_sports.includes(value)} onChange={event=>change("interested_sports",event.target.checked?[...form.interested_sports,value]:form.interested_sports.filter(sport=>sport!==value))}/><SportIcon sport={value}/><span>{label}</span></label>)}<p className="muted small">{form.interested_sports.length?`${form.interested_sports.length}개 선택했어요.`:"아직 찾는 중이에요. 다양한 운동의 크루를 둘러볼 수 있어요."}</p></fieldset>
        <label>운동 레벨<select value={form.level} onChange={event => change('level', event.target.value)}><option value="">선택 안 함</option>{Object.entries(LEVELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="crew-form-pair">
        <label>시/도<select value={form.region_sido} onChange={event => {setForm(previous => ({...previous, region_sido:event.target.value, region_sigungu:''}));setMessage('');setError('');}}><option value="">지역 제한 없음</option>{[...new Set(rows.map(row=>row.sido))].map(sido=><option key={sido}>{sido}</option>)}</select></label>
        <label>시/군/구<select value={form.region_sigungu} disabled={!form.region_sido} onChange={event=>change('region_sigungu',event.target.value)}><option value="">선택 안 함</option>{rows.filter(row=>row.sido===form.region_sido).map(row=><option key={row.sigungu}>{row.sigungu}</option>)}</select></label>
      </div>
      <fieldset className="crew-days"><legend>선호 요일 · 선택하지 않으면 요일 제한 없음</legend>{DAYS.map((day,index)=><label key={day}><input type="checkbox" checked={form.preferred_days.includes(index)} onChange={event=>change('preferred_days', event.target.checked ? [...form.preferred_days,index] : form.preferred_days.filter(value=>value!==index))}/>{day}</label>)}</fieldset>
      {error && <p className="crew-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <button className="btn btn-primary" type="submit">{busy ? '저장 중…' : '관심 운동·지역 저장'}</button>
    </fieldset></form>
  </section>;
}

