import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams, useBeforeUnload } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORT_LABEL } from '../../shared/ui.jsx';
import { createTracker, TRACKING_SPORTS } from './tracking.js';
import { saveGpsDraft, finalizeGpsDraft } from './drafts.js';
import RouteMap from './RouteMap.jsx';
import './tracking.css';
export default function TrackingPage() {
  const { user } = useAuth(), cache = useQueryClient(), navigate = useNavigate(), [params] = useSearchParams();
  const [sport, setSport] = useState(TRACKING_SPORTS.includes(params.get('sport')) ? params.get('sport') : '');
  const [track, setTrack] = useState({ status: 'idle', points: [], elapsed: 0, distance: 0, message: '', awake: false });
  const [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [discard, setDiscard] = useState(false);
  const tracker = useRef(null), lock = useRef(false), savedId = useRef(null), measurementId = useRef(null), kept = useRef(false);
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
  useBeforeUnload(event => { if (active || track.points.length && !savedId.current && !kept.current) { event.preventDefault(); event.returnValue = ''; } });
  async function save(later = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      if (!measurementId.current) measurementId.current = crypto.randomUUID();
      if (!kept.current) { await saveGpsDraft(supabase, measurementId.current, sport, track, note); kept.current = true; }
      if (!later && !savedId.current) savedId.current = await finalizeGpsDraft(supabase, measurementId.current, note);
      await cache.invalidateQueries({ queryKey: queryKeys.gpsDraftsRoot(user.id) });
      if (later) { navigate('/activities', { replace: true }); return; }
      await Promise.all([cache.invalidateQueries({ queryKey: queryKeys.activitiesRoot(user.id) }), cache.invalidateQueries({ queryKey: queryKeys.dashboardRoot(user.id) }), cache.invalidateQueries({ queryKey: queryKeys.attachmentChoices(user.id) }), cache.invalidateQueries({ queryKey: queryKeys.memberRoot(user.id) })]);
      navigate(`/activities/${savedId.current}`, { replace: true });
    } catch (cause) { setError(cause.message); }
    finally { lock.current = false; setBusy(false); }
  }
  const seconds = Math.floor(track.elapsed / 1000);
  return <main className={`tracking-page ${active ? 'tracking-active' : ''}`}>
    <header><p>CREWFIT · GPS</p><h1>{track.status === 'idle' ? 'GPS 측정' : `${SPORT_LABEL[sport]} 기록`}</h1></header>
    {track.status === 'idle' && <><fieldset className="tracking-sports"><legend>어떤 운동을 측정할까요?</legend>{TRACKING_SPORTS.map(value=><label key={value} data-selected={sport===value}><input type="radio" name="tracking-sport" value={value} checked={sport===value} onChange={()=>setSport(value)} />{SPORT_LABEL[value]}</label>)}</fieldset>
      <p>야외에서 사용해 주세요. 시작하면 위치 권한을 요청합니다. 화면을 켜고 이 탭을 유지해야 해요. 앱 전환·화면 잠금 시 측정이 종료됩니다.</p><p>처음 정확한 위치를 받으면 시간이 시작돼요. 새로고침하거나 페이지를 나가면 저장하지 않은 기록은 사라집니다.</p>
      <button className="btn btn-primary" disabled={!sport} onClick={() => { setError(''); measurementId.current = crypto.randomUUID(); kept.current = false; tracker.current.start(sport); }}>{sport ? `${SPORT_LABEL[sport]} 측정 시작` : '종목을 선택해 주세요'}</button><Link to="/activities">기록 목록으로</Link></>}
    <dl className="tracking-metrics"><div><dt>운동 시간</dt><dd>{String(Math.floor(seconds / 3600)).padStart(2, '0')}:{String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</dd></div><div><dt>이동 거리</dt><dd>{(track.distance / 1000).toFixed(2)} <small>km</small></dd></div></dl>
    <p role="status">{track.message}</p>
    {active && <><p>{track.awake ? '화면 켜짐 유지 중' : '화면 켜짐 유지를 사용할 수 없어요. 화면을 직접 켜 두세요.'}</p><p>정확한 위치 {track.points.length}개 · 측정 중에는 지도를 그리지 않아요.</p><button className="btn btn-primary" onClick={() => tracker.current.stop()}>측정 종료</button></>}
    {track.status === 'done' && <><RouteMap points={track.points} /><label>운동 메모<textarea value={note} maxLength={1000} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy || track.points.length < 2 || track.elapsed < 1000} onClick={()=>save(false)}>{busy ? '저장 중…' : '기록 저장하기'}</button>
      <button className="btn btn-ghost" disabled={busy || Boolean(savedId.current) || track.points.length < 2 || track.elapsed < 1000} onClick={()=>save(true)}>나중에 작성</button><p>나중에 작성하면 측정 결과를 계정에 보관해요. 운동 기록으로 저장하기 전에는 목표와 통계에 포함되지 않아요.</p>
      {track.points.length < 2 && <p>저장하려면 이동한 위치가 2개 이상 필요해요.</p>}
      <p>저장한 경로는 기본적으로 나만 볼 수 있어요. 피드에서 경로 공유를 켠 글에 첨부하면 글의 공개 범위를 따릅니다.</p>
      <button className="btn btn-ghost" disabled={busy} onClick={() => kept.current ? navigate('/activities', {replace:true}) : setDiscard(true)}>{kept.current ? '보관한 측정 목록으로' : '저장하지 않고 나가기'}</button>
      {discard && <div role="group" aria-label="측정 기록 버리기 확인"><p>수집한 위치와 측정 기록을 버릴까요?</p><button className="btn btn-ghost" disabled={busy} onClick={() => setDiscard(false)}>계속 보기</button><button className="btn btn-ghost" disabled={busy} onClick={() => navigate('/activities', { replace: true })}>기록 버리고 나가기</button></div>}
    </>}
    {error && <div role="alert"><p>{error}</p><a href="/activities" target="_blank" rel="noreferrer">새 탭에서 운동 목록 확인</a></div>}
  </main>;
}
