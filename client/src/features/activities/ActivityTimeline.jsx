import {Link} from 'react-router';
import {SPORT_LABEL} from '../../shared/ui.jsx';
import SportIcon from '../../shared/SportIcon.jsx';
import {detailDuration} from './activityDetail.js';
import {distanceFactor,distanceUnit} from './sports.js';
import {recordSource} from './recordSource.js';
import './activity-timeline.css';
export default function ActivityTimeline({items,returnTo}){
 const groups=new Map();for(const record of items){if(!groups.has(record.performed_on))groups.set(record.performed_on,[]);groups.get(record.performed_on).push(record);}
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),yesterday=new Date(Date.now()+9*3600000-86400000).toISOString().slice(0,10);
 return <div className="activity-timeline">{[...groups].map(([date,records])=>{const dateLabel=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'}).format(new Date(date+'T12:00:00+09:00'));return <section key={date} className="activity-day"><header className="activity-day-heading"><time dateTime={date}>{date===today?'오늘':date===yesterday?'어제':date.slice(0,4)+'년'}<span>{dateLabel}</span></time></header><ul>{records.map(record=><li key={record.id}><Link to={'/activities/'+record.id} state={{activitiesReturnTo:returnTo}} className="activity-timeline-card" data-sport={record.sport}><div className="activity-timeline-title"><SportIcon sport={record.sport}/><div><span className="activity-timeline-source">{recordSource(record)}</span><h3>{SPORT_LABEL[record.sport]||'운동'}</h3></div><span className="activity-timeline-open" aria-hidden="true">↗</span></div><p className={'activity-timeline-note'+(!record.note?.trim()?' is-empty':'')}>{record.note?.trim().split(/\r?\n/)[0]||'오늘의 움직임을 기록했어요.'}</p><div className="activity-timeline-metrics"><div><span>운동 시간</span><strong>{detailDuration(record.duration_sec)}</strong></div>{record.distance_m!=null&&<div><span>이동 거리</span><strong>{(record.distance_m/distanceFactor(record.sport)).toLocaleString('ko-KR',{maximumFractionDigits:2})}<small>{distanceUnit(record.sport)}</small></strong></div>}<span className="activity-timeline-detail">기록 보기</span></div></Link></li>)}</ul></section>;})}</div>;
}
