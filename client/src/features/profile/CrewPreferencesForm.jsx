import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS, LEVELS, DAYS, loadRegions } from '../crews/crews.js';
import { saveCrewPreferences } from './crewPreferences.js';
import '../crews/crews.css';

export default function CrewPreferencesForm({ userId, profile, settings }) {
  const cache = useQueryClient(), running = useRef(false);
  const [form, setForm] = useState({ main_sport: profile.main_sport || '', level: profile.level || '',
    region_sido: settings?.region_sido || '', region_sigungu: settings?.region_sigungu || '', preferred_days: settings?.preferred_days || [] });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const regions = useQuery({queryKey:queryKeys.regions(userId), queryFn:()=>loadRegions(supabase), retry:false});
  const rows = regions.data || [];
  const change = (key, value) => { setForm(previous => ({...previous, [key]:value})); setMessage(''); setError(''); };
  async function submit(event) {
    event.preventDefault();
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try { await saveCrewPreferences(supabase, userId, form, rows); setMessage('추천 설정을 저장했어요. 크루 탭에서 추천을 확인해 보세요.'); }
    catch (cause) { setError(cause.message); }
    finally {
      await Promise.all([cache.invalidateQueries({queryKey:queryKeys.me(userId)}), cache.invalidateQueries({queryKey:queryKeys.crewMatches(userId)})]);
      running.current = false; setBusy(false);
    }
  }
  return <section id="crew-preferences" className="card stack" aria-labelledby="crew-preferences-title">
    <h2 id="crew-preferences-title">크루 추천 설정</h2>
    <p className="crew-form-note">주종목은 필수이며 나머지는 선택입니다. 지역·요일은 공개 프로필에 노출하지 않고 추천에 사용해요.</p>
    {regions.isPending && <p role="status">지역 목록을 불러오고 있어요.</p>}
    {regions.isError && <div role="alert"><p>지역 목록을 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={() => regions.refetch()}>다시 조회</button></div>}
    <form className="crew-form" onSubmit={submit}><fieldset disabled={busy || !regions.isSuccess}>
      <div className="crew-form-pair">
        <label>주종목<select required value={form.main_sport} onChange={event => change('main_sport', event.target.value)}><option value="">종목 선택</option>{Object.entries(SPORTS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>운동 레벨<select value={form.level} onChange={event => change('level', event.target.value)}><option value="">선택 안 함</option>{Object.entries(LEVELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="crew-form-pair">
        <label>시/도<select value={form.region_sido} onChange={event => {setForm(previous => ({...previous, region_sido:event.target.value, region_sigungu:''}));setMessage('');setError('');}}><option value="">지역 제한 없음</option>{[...new Set(rows.map(row=>row.sido))].map(sido=><option key={sido}>{sido}</option>)}</select></label>
        <label>시/군/구<select value={form.region_sigungu} disabled={!form.region_sido} onChange={event=>change('region_sigungu',event.target.value)}><option value="">선택 안 함</option>{rows.filter(row=>row.sido===form.region_sido).map(row=><option key={row.sigungu}>{row.sigungu}</option>)}</select></label>
      </div>
      <fieldset className="crew-days"><legend>선호 요일 · 선택하지 않으면 요일 제한 없음</legend>{DAYS.map((day,index)=><label key={day}><input type="checkbox" checked={form.preferred_days.includes(index)} onChange={event=>change('preferred_days', event.target.checked ? [...form.preferred_days,index] : form.preferred_days.filter(value=>value!==index))}/>{day}</label>)}</fieldset>
      {error && <p className="crew-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <button className="btn btn-primary" type="submit">{busy ? '저장 중…' : '추천 설정 저장'}</button>
    </fieldset></form>
  </section>;
}
