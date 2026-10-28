import GpsPhoneDialog from '../tracking/GpsPhoneDialog.jsx';
import { isMobileTrackingDevice } from '../tracking/device.js';
import ActivityTimeline from './ActivityTimeline.jsx';
import { Suspense, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, Field, SPORT_LABEL } from '../../shared/ui.jsx';
import { filterError, LIST_SPORTS, listURL } from './activityList.js';
import './activity-list.css';
import './exercise-merge.css';
import RecordTabs from '../../shared/RecordTabs.jsx';
import { GpsDraftList } from '../tracking/index.js';
import SportIcon from '../../shared/SportIcon.jsx';
import './record-polish.css';

function Filters({ filters, onFilter }) {
  const [draft, setDraft] = useState(filters);
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const message = filterError(draft);
    setError(message);
    if (!message) onFilter(draft);
  }
  return <form className="activity-filters" onSubmit={submit} noValidate aria-label="운동 기록 필터">
    <div className="field"><div className="field-label-row"><label htmlFor="filter-sport">종목</label></div>
      <select id="filter-sport" value={draft.sport} onChange={e => setDraft({ ...draft, sport: e.target.value })}>
        <option value="">전체 종목</option>
        {LIST_SPORTS.map(sport => <option key={sport} value={sport}>{SPORT_LABEL[sport]}</option>)}
      </select>
    </div>
    <Field id="filter-from" label="시작일" type="date" min="1900-01-01" max="9999-12-24" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} />
    <Field id="filter-to" label="종료일" type="date" min="1900-01-01" max="9999-12-24" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} error={error} />
    <div className="activity-filter-actions"><Button type="submit" variant="ghost">적용</Button><Button variant="ghost" onClick={() => { const empty = { sport: '', from: '', to: '' }; setDraft(empty); setError(''); onFilter(empty); }}>초기화</Button></div>
  </form>;
}

export default function ActivityListView({ filters, filterMessage, records, onFilter }) {
  const [phoneGuide, setPhoneGuide] = useState(false);
  const returnTo = listURL(filters);
  const items = records.data?.pages.flatMap(page => page.items) || [];
  const filtered = Boolean(filters.sport || filters.from || filters.to);
  const nextLock = useRef(false);
  async function more() {
    if (nextLock.current || records.isFetching) return;
    nextLock.current = true;
    try { await records.fetchNextPage(); } finally { nextLock.current = false; }
  }
  return <div className="activity-library">
    <RecordTabs active="activities" />
    {phoneGuide && <GpsPhoneDialog onClose={() => setPhoneGuide(false)}/>}
    <header className="activity-library-heading"><div><span className="section-eyebrow">나의 운동 일지</span><h1>움직인 만큼, 쌓이는 기록</h1><p>가벼운 산책부터 마지막 한 세트까지.</p></div>
    </header>
    <div className="record-entry-grid">
      <Link className="record-entry record-entry-gps" to="/activities/track" onClick={e => { if (!isMobileTrackingDevice(navigator)) { e.preventDefault(); setPhoneGuide(true); } }}><span className="record-entry-tag">지금 밖에서 운동한다면</span><strong>GPS 측정 시작</strong><p>러닝 · 걷기 · 자전거<br/>움직인 경로와 시간을 함께 남겨요.</p><span className="record-entry-bottom">종목 선택하기 <span aria-hidden="true">↗</span></span><svg className="record-route-art" viewBox="0 0 200 170" fill="none" aria-hidden="true"><path d="M180 0C70 0 195 70 90 80S10 145 165 150" stroke="currentColor" strokeWidth="24" opacity=".08"/><path d="M180 0C70 0 195 70 90 80S10 145 165 150" stroke="currentColor" strokeWidth="2" strokeDasharray="5 7"/><circle cx="165" cy="150" r="7" fill="currentColor"/></svg></Link>
      <Link className="record-entry record-entry-manual" to="/activities/new" state={{activitiesReturnTo:returnTo}}><span className="record-entry-tag">운동을 마쳤다면</span><strong>직접 기록하기</strong><p>모든 종목의 시간과 거리,<br/>헬스 세트와 오늘의 메모까지.</p><span className="record-entry-bottom">운동 남기기 <span aria-hidden="true">＋</span></span></Link>
    </div>
    <Suspense fallback={<p>보관한 측정 확인 중…</p>}><GpsDraftList /></Suspense>
    <div className="record-history-heading"><h2>내 운동 모아보기</h2><Link to="/activities/exercises" state={{activitiesReturnTo:returnTo}}>운동명 관리 ↗</Link></div>
    <div className="record-sport-filters" role="group" aria-label="종목 빠른 선택">{['',...LIST_SPORTS].map(sport=><button type="button" key={sport} aria-pressed={filters.sport===sport} onClick={()=>onFilter({...filters,sport})}>{sport&&<SportIcon sport={sport}/>}<span>{SPORT_LABEL[sport]||'전체'}</span></button>)}</div>
    <section className="record-date-filter"><h3>날짜 · 상세 필터{filtered?' · 적용 중':''}</h3><Filters key={returnTo} filters={filters} onFilter={onFilter} /></section>
    <section className="activity-library-results" aria-label="운동 기록 목록" aria-busy={records.isFetching}>
      <div className="activity-library-caption"><span>최신 날짜순</span><span role="status">{!filterMessage && records.data ? items.length + '건 표시' + (records.hasNextPage ? ' · 더 있음' : '') : ''}</span></div>
      {filterMessage ? <p className="activity-list-message" role="alert">{filterMessage}</p>
        : records.isPending ? <p className="activity-list-message" role="status">운동 기록을 불러오고 있어요.</p>
        : !records.data && records.isError ? <div className="activity-list-message" role="alert"><p>기록을 불러오지 못했어요.</p><Button variant="ghost" onClick={() => records.refetch()}>다시 불러오기</Button></div>
        : <>
          {items.length ? <ActivityTimeline items={items} returnTo={returnTo}/> : <div className="activity-list-message"><h2>{filtered ? '조건에 맞는 기록이 없어요.' : '아직 운동 기록이 없어요.'}</h2><p>{filtered ? '종목이나 날짜 범위를 바꿔 확인해 보세요.' : '첫 운동을 기록하면 이곳에 차곡차곡 모입니다.'}</p>
            {filtered ? <Button variant="ghost" onClick={() => onFilter({ sport: '', from: '', to: '' })}>전체 기록 보기</Button> : <Link className="btn btn-ghost" to="/activities/new" state={{ activitiesReturnTo: returnTo }}>첫 운동 기록하기</Link>}</div>}
          {records.isError && records.data && <div className="activity-list-message" role="alert"><p>{records.isFetchNextPageError ? '다음 기록을 불러오지 못했어요. 현재 목록은 유지됩니다.' : '최신 기록을 확인하지 못했어요. 이전 조회 결과입니다.'}</p>
            <Button variant="ghost" disabled={records.isFetching} onClick={records.isFetchNextPageError ? more : () => records.refetch()}>다시 불러오기</Button></div>}
          {records.hasNextPage && !records.isFetchNextPageError && <Button className="activity-list-more" variant="ghost" disabled={records.isFetching} onClick={more}>{records.isFetchingNextPage ? '불러오는 중…' : '더 보기'}</Button>}
        </>}
    </section>
  </div>;
}
