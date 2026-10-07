import {Link} from 'react-router';
import {CrewCover} from '../../shared/CommunityMedia.jsx';
import CrewMark from '../../shared/CrewMark.jsx';
import {SPORTS,LEVELS,dayLabel} from './crews.js';
export default function CrewCard({crew,status,recent}){
 return <Link to={`/crews/${crew.id}`} className="crew-card crew-card-visual"><CrewCover crew={crew} compact/><div className="crew-card-content"><div className="crew-card-top"><span>{SPORTS[crew.sport]} · {crew.region_sigungu}</span><span>{status==='pending'?'승인 대기':status==='approved'?'내 크루':crew.join_mode==='open'?'바로 가입':'승인 후 가입'}</span></div><div className="crew-identity"><CrewMark name={crew.name} sport={crew.sport}/><h2>{crew.name}</h2></div><p className="crew-card-description">{crew.description||'함께 운동하며 새로운 이야기를 만들어 가요.'}</p><div className="crew-card-bottom"><span>{dayLabel(crew.activity_days)}</span><span>{LEVELS[crew.level]||'누구나'}</span></div>{recent&&<p className="crew-recent">최근 글 {new Date(recent).toLocaleDateString('ko-KR',{month:'long',day:'numeric',timeZone:'Asia/Seoul'})}</p>}</div></Link>;
}
