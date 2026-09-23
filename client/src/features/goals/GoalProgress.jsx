import { Link } from 'react-router';
import { SPORT_LABEL } from '../../shared/ui.jsx';
import { GOAL_TYPES, goalNumber, goalUnit } from './goals.js';
import './goals.css';

export default function GoalProgress({ log }) {
  const ready = !log.isPending && !log.isError && Array.isArray(log.data?.goals);
  return <section className="goal-progress" aria-labelledby="goal-progress-title">
    <header className="goal-progress-heading"><h2 id="goal-progress-title">현재 목표</h2><Link className="btn btn-ghost" to="/goals">목표 관리</Link></header>
    {log.isPending ? <p className="goal-state" role="status">목표 달성률을 불러오고 있어요.</p>
      : !ready ? <p className="goal-state">목표 달성률을 확인하지 못했어요.</p>
      : !log.data.goals.length ? <p className="goal-state">진행 중인 목표가 없어요. 목표 관리에서 주간·월간 목표를 설정하세요.</p>
      : <ul className="goal-progress-list">{log.data.goals.map(goal => {
        const percent = Math.floor(goal.progress * 100);
        const title = `${goal.period === 'week' ? '이번 주' : '이번 달'} · ${SPORT_LABEL[goal.sport] || '전체 종목'} ${GOAL_TYPES[goal.type]}`;
        return <li key={goal.id}>
          <div className="goal-progress-label"><div><h3>{title}</h3><p>{goal.from.replaceAll('-', '.')} — {goal.to.replaceAll('-', '.')}</p></div>
            <span className="goal-progress-value"><strong>{goalNumber(goal.current, goal)}</strong> / {goalNumber(goal.target, goal)} {goalUnit(goal)}</span></div>
          <div className="goal-progress-track"><progress max="100" value={Math.min(100, percent)} aria-label={title} /><span>{goal.progress >= 1 ? `달성 · ${percent}%` : `${percent}%`}</span></div>
        </li>;
      })}</ul>}
  </section>;
}
