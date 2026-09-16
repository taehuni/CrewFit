import { Link } from 'react-router';
import { SPORT_LABEL } from '../../shared/ui.jsx';
import { ACTIVITY_SPORTS, distanceFactor, distanceUnit } from '../activities/index.js';
import { shortDate, weekLabel } from './week.js';
import './home.css';

function durationLabel(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export default function HomeView({ log, days, today, offset, onWeekChange }) {
  const ready = !log.isPending && !log.isError && Boolean(log.data);
  const records = ready ? log.data.recent : [];
  const totals = ready ? log.data.totals : null;
  return (
    <div className="home-workspace">
      <header className="home-heading">
        <h1>내 운동</h1>
        <Link to="/activities/new" className="btn btn-primary home-record-link"><span aria-hidden="true">＋</span> 운동 기록하기</Link>
      </header>

      <section className="home-week-section" aria-labelledby="week-title">
        <div className="home-section-head">
          <div><h2 id="week-title">{offset === 0 ? '이번 주' : '주간 기록'}</h2><p>{weekLabel(days)}</p></div>
          <div className="week-controls">
            <button type="button" aria-label="이전 주" onClick={() => onWeekChange(offset - 1)}>‹</button>
            <button type="button" onClick={() => onWeekChange(0)} disabled={offset === 0}>이번 주</button>
            <button type="button" aria-label="다음 주" onClick={() => onWeekChange(offset + 1)} disabled={offset === 0}>›</button>
          </div>
        </div>
        <dl className="home-totals" aria-label="주간 운동 합계" aria-busy={log.isPending}>
          <div><dt>운동 횟수</dt><dd><strong>{totals ? totals.activity_count : '—'}</strong><span>회</span></dd></div>
          <div><dt>총 거리</dt><dd><strong>{totals ? (totals.distance_m / 1000).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</strong><span>km</span></dd></div>
          <div><dt>운동 시간</dt><dd><strong>{totals ? durationLabel(totals.duration_sec) : '—'}</strong><span>시간:분</span></dd></div>
        </dl>
        <ol className="home-week" aria-label="주간 운동 달력">
          {days.map((date, index) => {
            const count = ready ? (log.data.days.find(day => day.date === date)?.activity_count || 0) : null;
            return <li key={date} aria-current={date === today ? 'date' : undefined} data-active={count > 0 || undefined}>
              <span>{date === today ? '오늘' : ['월', '화', '수', '목', '금', '토', '일'][index]}</span>
              <strong>{Number(date.slice(8))}</strong>
              <span className="week-marks">{count > 0 ? `${count}회` : <span className="sr-only">{count == null ? (log.isPending ? '불러오는 중' : '조회 실패') : '운동 기록 없음'}</span>}</span>
            </li>;
          })}
        </ol>
      </section>

      <section className="home-records" aria-labelledby="records-title">
        <div className="home-records-head"><h2 id="records-title">운동 기록</h2><span>{ready ? `총 ${totals.activity_count}건${totals.activity_count > 50 ? ' · 최근 50건 표시' : ''}` : '선택한 주'}</span></div>
        {log.isPending ? <div className="home-log-message" role="status">운동 기록을 불러오고 있어요.</div>
          : log.isError ? <div className="home-log-message" role="alert"><p>기록을 불러오지 못했어요. 연결 상태를 확인해 주세요.</p><button type="button" className="home-text-button" onClick={log.refetch}>다시 불러오기</button></div>
          : records.length ? <ul className="home-record-list">{records.map(record => (
            <li key={record.id}>
              <Link to={`/activities/${record.id}`} className="home-record-row" aria-label={`${shortDate(record.performed_on)} ${SPORT_LABEL[record.sport] || '운동'} 기록 상세`}>
              <span className="record-date">{shortDate(record.performed_on)}</span>
              <div className="record-title"><strong>{SPORT_LABEL[record.sport] || '운동'}</strong></div>
              <p>{record.distance_m != null && <span>{(record.distance_m / distanceFactor(record.sport)).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}<small>{distanceUnit(record.sport)}</small></span>}<span>{Math.floor(record.duration_sec / 60)}<small>분</small></span></p>
              <span className="record-open" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}</ul>
          : <div className="home-log-message home-log-empty">
            <p>이 주에 기록한 운동이 없어요.</p>
            <div className="home-sport-actions" role="group" aria-label="종목별 운동 기록하기">
              {ACTIVITY_SPORTS.map(sport => <Link key={sport} to={'/activities/new?sport=' + sport} className="home-sport-link"><strong>{SPORT_LABEL[sport]} 기록하기</strong><span>{sport === 'gym' ? '운동 · 세트 · 중량' : sport === 'swimming' ? '거리 · 시간 · 랩 수' : sport === 'other' ? '시간 · 메모' : '거리 · 시간'}</span></Link>)}
            </div>
          </div>}
      </section>
    </div>
  );
}
