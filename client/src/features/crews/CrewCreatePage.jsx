import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS, LEVELS, DAYS, createCrew, loadRegions } from './crews.js';
import './crews.css';

export default function CrewCreatePage() {
  const { user } = useAuth(), navigate = useNavigate(), cache = useQueryClient();
  const regions = useQuery({ queryKey: queryKeys.regions(user.id), queryFn: () => loadRegions(supabase), retry: false });
  const [form, setForm] = useState({name:'',description:'',sport:'running',level:'',region_sido:'',region_sigungu:'',activity_days:[],join_mode:'open'});
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  function change(key,value) { setForm(old => ({...old,[key]:value,...(key==='region_sido' ? {region_sigungu:''} : {})})); }
  async function submit(event) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const crew = await createCrew(supabase,user.id,form,regions.data || []);
      void cache.invalidateQueries({queryKey:queryKeys.crewListRoot(user.id)});
      navigate(`/crews/${crew.id}`,{replace:true});
    } catch (error) { setError(error.message); }
    finally { pending.current=false;setBusy(false); }
  }
  return <div className="crews-page">
    <header className="crews-heading"><h1>크루 만들기</h1><Link to="/crews">크루 목록</Link></header>
    <form className="crew-form" onSubmit={submit}>
      <fieldset disabled={busy}><legend className="sr-only">크루 정보</legend>
        <label>크루 이름<input name="name" required minLength={2} maxLength={40} value={form.name} onChange={e=>change('name',e.target.value)} placeholder="예: 한강 저녁 러닝" /></label>
        <div className="crew-form-pair"><label>종목<select value={form.sport} onChange={e=>change('sport',e.target.value)}>{Object.entries(SPORTS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label>레벨<select value={form.level} onChange={e=>change('level',e.target.value)}><option value="">레벨 무관</option>{Object.entries(LEVELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
        {regions.isPending && <p role="status">지역 목록을 불러오고 있어요.</p>}
        {regions.error && <div role="alert">지역 목록을 불러오지 못했어요. <button type="button" onClick={()=>regions.refetch()}>다시 조회</button></div>}
        {regions.data?.length===0 && <p role="alert">지역 데이터가 없어요. seed_regions.sql 적용이 필요합니다.</p>}
        <div className="crew-form-pair"><label>시·도<select required value={form.region_sido} onChange={e=>change('region_sido',e.target.value)}><option value="">선택해 주세요</option>{[...new Set((regions.data || []).map(r=>r.sido))].map(v=><option key={v}>{v}</option>)}</select></label>
          <label>시·군·구<select required disabled={!form.region_sido} value={form.region_sigungu} onChange={e=>change('region_sigungu',e.target.value)}><option value="">선택해 주세요</option>{(regions.data || []).filter(r=>r.sido===form.region_sido).map(r=><option key={r.sigungu}>{r.sigungu}</option>)}</select></label></div>
        <fieldset className="crew-days"><legend>활동 요일 <small>미선택 시 협의</small></legend>{DAYS.map((day,index)=><label key={day}><input type="checkbox" checked={form.activity_days.includes(index)} onChange={e=>change('activity_days',e.target.checked ? [...form.activity_days,index] : form.activity_days.filter(d=>d!==index))} />{day}</label>)}</fieldset>
        <label>가입 방식<select value={form.join_mode} onChange={e=>change('join_mode',e.target.value)}><option value="open">즉시 가입형</option><option value="approval">크루장 승인형</option></select></label>
        <label>크루 소개 <small>선택 · 1,000자 이내</small><textarea rows={5} maxLength={1000} value={form.description} onChange={e=>change('description',e.target.value)} placeholder="모이는 장소, 시간, 활동 방식을 알려주세요." /></label>
        <p className="crew-form-note">만든 회원이 크루장으로 자동 등록됩니다. 가입·승인 기능은 다음 단계에서 연결됩니다.</p>
        {error && <p role="alert" className="crew-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy || !regions.data?.length || !!regions.error}>{busy ? '만드는 중…' : '크루 만들기'}</button>
      </fieldset>
    </form>
  </div>;
}
