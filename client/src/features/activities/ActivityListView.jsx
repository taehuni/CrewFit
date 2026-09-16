import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, Field, SPORT_LABEL } from '../../shared/ui.jsx';
import { detailDuration } from './activityDetail.js';
import { filterError, LIST_SPORTS, listURL } from './activityList.js';
import { distanceFactor, distanceUnit } from './sports.js';
import './activity-list.css';
import './exercise-merge.css';

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
    <header className="activity-library-heading"><div><h1>운동 기록</h1><p>날짜순으로 모아 보는 내 운동</p></div>
      <div className="activity-library-tools"><Link className="btn btn-primary" to="/activities/new" state={{ activitiesReturnTo: returnTo }}>＋ 운동 기록하기</Link>
        <Link to="/activities/exercises" state={{ activitiesReturnTo: returnTo }}>운동 이름 정리</Link></div>
    </header>
    <Filters key={returnTo} filters={filters} onFilter={onFilter} />
    <section className="activity-library-results" aria-label="운동 기록 목록" aria-busy={records.isFetching}>
      <div className="activity-library-caption"><span>최신 날짜순</span><span role="status">{!filterMessage && records.data ? items.length + '건 표시' + (records.hasNextPage ? ' · 더 있음' : '') : ''}</span></div>
      {filterMessage ? <p className="activity-list-message" role="alert">{filterMessage}</p>
        : records.isPending ? <p className="activity-list-message" role="status">운동 기록을 불러오고 있어요.</p>
        : !records.data && records.isError ? <div className="activity-list-message" role="alert"><p>기록을 불러오지 못했어요.</p><Button variant="ghost" onClick={() => records.refetch()}>다시 불러오기</Button></div>
        : <>
          {items.length ? <ul className="activity-library-list">{items.map(record => <li key={record.id}>
            <Link to={'/activities/' + record.id} state={{ activitiesReturnTo: returnTo }} className="activity-library-row">
              <time dateTime={record.performed_on}>{record.performed_on.replaceAll('-', '.')}</time>
              <div className="activity-library-name"><strong>{SPORT_LABEL[record.sport] || '운동'}</strong>{record.note?.trim() && <p>{record.note.trim().split(/\r?\n/)[0]}</p>}</div>
              <div className="activity-library-metrics">
                {record.distance_m != null && <span><b>{(record.distance_m / distanceFactor(record.sport)).toLocaleString('ko-KR', { maximumFractionDigits: 3 })}</b><small>{distanceUnit(record.sport)}</small></span>}
                <span>{detailDuration(record.duration_sec)}</span>
              </div><span className="activity-library-chevron" aria-hidden="true">›</span>
            </Link>
          </li>)}</ul> : <div className="activity-list-message"><h2>{filtered ? '조건에 맞는 기록이 없어요.' : '아직 운동 기록이 없어요.'}</h2><p>{filtered ? '종목이나 날짜 범위를 바꿔 확인해 보세요.' : '첫 운동을 기록하면 이곳에 차곡차곡 모입니다.'}</p>
            {filtered ? <Button variant="ghost" onClick={() => onFilter({ sport: '', from: '', to: '' })}>전체 기록 보기</Button> : <Link className="btn btn-ghost" to="/activities/new" state={{ activitiesReturnTo: returnTo }}>첫 운동 기록하기</Link>}</div>}
          {records.isError && records.data && <div className="activity-list-message" role="alert"><p>{records.isFetchNextPageError ? '다음 기록을 불러오지 못했어요. 현재 목록은 유지됩니다.' : '최신 기록을 확인하지 못했어요. 이전 조회 결과입니다.'}</p>
            <Button variant="ghost" disabled={records.isFetching} onClick={records.isFetchNextPageError ? more : () => records.refetch()}>다시 불러오기</Button></div>}
          {records.hasNextPage && !records.isFetchNextPageError && <Button className="activity-list-more" variant="ghost" disabled={records.isFetching} onClick={more}>{records.isFetchingNextPage ? '불러오는 중…' : '더 보기'}</Button>}
        </>}
    </section>
  </div>;
}
