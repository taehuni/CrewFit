import { Link, useLocation } from 'react-router';
import { Button, SPORT_LABEL } from '../../shared/ui.jsx';
import { detailDuration, groupExerciseSets } from './activityDetail.js';
import './activity-detail.css';
import DeleteActivityButton from './DeleteActivityButton.jsx';
import { activitiesReturnTo } from './activityList.js';
import { ACTIVITY_SPORTS, distanceFactor, distanceUnit } from './sports.js';

export default function ActivityDetailView({ detail, onDelete }) {
  const location = useLocation();
  const returnTo = activitiesReturnTo(location.state);
  const data = !detail.isPending && !detail.isError ? detail.data : null;
  const activity = data?.activity;
  const groups = groupExerciseSets(data?.sets || []);
  return <article className="activity-detail">
    <header className="activity-detail-heading">
      <Link to={returnTo || '/home'} state={activity ? { performedOn: activity.performed_on } : undefined} className="activity-back">운동 목록으로</Link>
      <h1>{activity ? (SPORT_LABEL[activity.sport] || '운동') + ' 기록' : '운동 기록 상세'}</h1>
      {activity && <time dateTime={activity.performed_on}>{activity.performed_on.replaceAll('-', '.')}</time>}
      {activity && <div className="activity-detail-actions">
        {ACTIVITY_SPORTS.includes(activity.sport) && <Link to={`/activities/${activity.id}/edit`} state={location.state} className="btn btn-ghost">수정</Link>}
        {onDelete && <DeleteActivityButton onDelete={onDelete} />}
      </div>}
    </header>
    {detail.isPending ? <p className="activity-detail-state" role="status">운동 기록을 불러오고 있어요.</p>
      : detail.isError ? <div className="activity-detail-state" role="alert"><p>기록을 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.</p><Button variant="ghost" onClick={detail.refetch}>다시 불러오기</Button></div>
      : !activity ? <div className="activity-detail-state"><h2>기록을 찾을 수 없어요.</h2><p>삭제되었거나 볼 수 없는 기록입니다.</p></div>
      : <>
        <dl className="activity-detail-summary">
          <div><dt>운동 시간</dt><dd>{detailDuration(activity.duration_sec)}</dd></div>
          {activity.distance_m != null && <div><dt>거리</dt><dd>{(activity.distance_m / distanceFactor(activity.sport)).toLocaleString('ko-KR', { maximumFractionDigits: 3 })}<small>{distanceUnit(activity.sport)}</small></dd></div>}
          {activity.sport === 'swimming' && Number.isInteger(activity.details?.lap_count) && activity.details.lap_count >= 0 && <div><dt>랩 수 · 편도 기준</dt><dd>{activity.details.lap_count}<small>랩</small></dd></div>}
          {activity.sport === 'gym' && <div><dt>저장된 세트</dt><dd>{data.sets.length}<small>세트 · {groups.length}개 운동</small></dd></div>}
        </dl>
        {activity.sport === 'gym' && <section className="activity-detail-sets" aria-labelledby="detail-sets-title">
          <h2 id="detail-sets-title">운동별 세트</h2>
          {groups.length ? groups.map(group => <section className="exercise-detail" key={group.name}>
            <h3>{group.name}</h3>
            <table>
              <caption className="sr-only">{group.name} 세트별 횟수와 중량</caption>
              <thead><tr><th scope="col">세트</th><th scope="col">횟수</th><th scope="col">중량</th></tr></thead>
              <tbody>{group.sets.map(set => <tr key={set.id}>
                <th scope="row">{set.set_no}</th>
                <td>{set.reps == null ? <span className="detail-missing">미입력</span> : <>{set.reps}<small>회</small></>}</td>
                <td>{set.weight_kg == null ? <span className="detail-missing">미입력</span> : <>{Number(set.weight_kg).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}<small>kg</small></>}</td>
              </tr>)}</tbody>
            </table>
          </section>) : <p className="detail-missing">저장된 세트가 없어요.</p>}
        </section>}
        <section className="activity-detail-note" aria-labelledby="detail-note-title">
          <h2 id="detail-note-title">메모</h2>
          {activity.note?.trim() ? <p>{activity.note}</p> : <p className="detail-missing">남긴 메모가 없어요.</p>}
        </section>
      </>}
  </article>;
}
