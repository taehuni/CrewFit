import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams, useBeforeUnload } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORT_LABEL } from '../../shared/ui.jsx';
import { createTracker, TRACKING_SPORTS, saveTrackedActivity } from './tracking.js';
import RouteMap from './RouteMap.jsx';
import './tracking.css';
export default function TrackingPage() {
  const { user } = useAuth(), cache = useQueryClient(), navigate = useNavigate(), [params] = useSearchParams();
  const [sport, setSport] = useState(TRACKING_SPORTS.includes(params.get('sport')) ? params.get('sport') : 'running');
  const [track, setTrack] = useState({ status: 'idle', points: [], elapsed: 0, distance: 0, message: '', awake: false });
  const [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [discard, setDiscard] = useState(false);
  const tracker = useRef(null), lock = useRef(false), savedId = useRef(null);
  const active = track.status === 'waiting' || track.status === 'running';
  useEffect(() => {
    const engine = createTracker({ geo: navigator.geolocation, wakeLock: navigator.wakeLock, onChange: setTrack }); tracker.current = engine;
    const timer = setInterval(() => engine.tick(), 1000);
    return () => { clearInterval(timer); engine.dispose(); };
  }, [user.id]);
  useEffect(() => {
    const hide = () => { if (document.hidden && active) tracker.current.stop('화면이 숨겨져 측정을 종료했어요. 수집된 구간을 저장해 주세요.'); };
    document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide);
  }, [active]);
  useBeforeUnload(event => { if (active || track.points.length && !savedId.current) { event.preventDefault(); event.returnValue = ''; } });
  async function save() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      if (!savedId.current) savedId.current = await saveTrackedActivity(supabase, sport, track, note);
      await Promise.all([cache.invalidateQueries({ queryKey: queryKeys.activitiesRoot(user.id) }), cache.invalidateQueries({ queryKey: queryKeys.dashboardRoot(user.id) }), cache.invalidateQueries({ queryKey: queryKeys.attachmentChoices(user.id) }), cache.invalidateQueries({ queryKey: queryKeys.memberRoot(user.id) })]);
      navigate(`/activities/${savedId.current}`, { replace: true });
    } catch (cause) { setError(cause.message); }
    finally { lock.current = false; setBusy(false); }
  }
  const seconds = Math.floor(track.elapsed / 1000);
  return <main className={`tracking-page ${active ? 'tracking-active' : ''}`}>
    <header><p>CREWFIT · GPS</p><h1>{SPORT_LABEL[sport]} 기록</h1></header>
    {track.status === 'idle' && <><label>운동 종목<select value={sport} onChange={event => setSport(event.target.value)}>{TRACKING_SPORTS.map(value => <option key={value} value={value}>{SPORT_LABEL[value]}</option>)}</select></label>
      <p>야외에서 사용해 주세요. 시작하면 위치 권한을 요청합니다. 화면을 켜고 이 탭을 유지해야 해요. 앱 전환·화면 잠금 시 측정이 종료됩니다.</p><p>처음 정확한 위치를 받으면 시간이 시작돼요. 새로고침하거나 페이지를 나가면 저장하지 않은 기록은 사라집니다.</p>
      <button className="btn btn-primary" onClick={() => { setError(''); tracker.current.start(sport); }}>GPS 측정 시작</button><Link to="/activities/new">수동 기록으로</Link></>}
    <dl className="tracking-metrics"><div><dt>운동 시간</dt><dd>{String(Math.floor(seconds / 3600)).padStart(2, '0')}:{String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</dd></div><div><dt>이동 거리</dt><dd>{(track.distance / 1000).toFixed(2)} <small>km</small></dd></div></dl>
    <p role="status">{track.message}</p>
    {active && <><p>{track.awake ? '화면 켜짐 유지 중' : '화면 켜짐 유지를 사용할 수 없어요. 화면을 직접 켜 두세요.'}</p><p>정확한 위치 {track.points.length}개 · 측정 중에는 지도를 그리지 않아요.</p><button className="btn btn-primary" onClick={() => tracker.current.stop()}>측정 종료</button></>}
    {track.status === 'done' && <><RouteMap points={track.points} /><label>운동 메모<textarea value={note} maxLength={1000} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy || track.points.length < 2 || track.elapsed < 1000} onClick={save}>{busy ? '저장 중…' : '운동 기록 저장'}</button>
      {track.points.length < 2 && <p>저장하려면 이동한 위치가 2개 이상 필요해요.</p>}
      <p>저장한 경로는 기본적으로 나만 볼 수 있어요. 피드에서 경로 공유를 켠 글에 첨부하면 글의 공개 범위를 따릅니다.</p>
      <button className="btn btn-ghost" disabled={busy} onClick={() => setDiscard(true)}>저장하지 않고 나가기</button>
      {discard && <div role="group" aria-label="측정 기록 버리기 확인"><p>수집한 위치와 측정 기록을 버릴까요?</p><button className="btn btn-ghost" disabled={busy} onClick={() => setDiscard(false)}>계속 보기</button><button className="btn btn-ghost" disabled={busy} onClick={() => navigate('/activities/new', { replace: true })}>기록 버리고 나가기</button></div>}
    </>}
    {error && <div role="alert"><p>{error}</p><a href="/activities" target="_blank" rel="noreferrer">새 탭에서 운동 목록 확인</a></div>}
  </main>;
}
