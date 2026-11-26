import GpsPhoneDialog from './GpsPhoneDialog.jsx';
import { isMobileTrackingDevice } from './device.js';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { createClient } from '@supabase/supabase-js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORT_LABEL } from '../../shared/ui.jsx';
import { createTracker, TRACKING_SPORTS } from './tracking.js';
import { saveGpsDraft, finalizeGpsDraft } from './drafts.js';
import RouteMap from './RouteMap.jsx';
import SportIcon from '../../shared/SportIcon.jsx';
import useLeaveGuard from '../../shared/useLeaveGuard.jsx';
import './tracking.css';
import NativeTrackingPage from './NativeTrackingPage.jsx';
import { isNativeTracking } from './nativeTracking.js';
export default function TrackingPage() {
  const { user } = useAuth();
  const navigate = useNavigate(), [params] = useSearchParams();
  if (isNativeTracking()) return <NativeTrackingPage key={user.id} />;
  if (!isMobileTrackingDevice(navigator)) return <GpsPhoneDialog sport={params.get('sport')} onClose={() => navigate('/activities', { replace: true })}/>;
  return <MobileTrackingPage key={user.id}/>;
}
function MobileTrackingPage() {
  const { user, token } = useAuth(), cache = useQueryClient(), navigate = useNavigate(), [params] = useSearchParams();
  const [sport, setSport] = useState(TRACKING_SPORTS.includes(params.get('sport')) ? params.get('sport') : '');
  const [track, setTrack] = useState({ status: 'idle', points: [], elapsed: 0, distance: 0, message: '', awake: false });
  const [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [discard, setDiscard] = useState(false);
  const tracker = useRef(null), lock = useRef(false), savedId = useRef(null), measurementId = useRef(null), kept = useRef(false), discardConfirmed = useRef(false);
  const mounted = useRef(false);
  const active = track.status === 'waiting' || track.status === 'running';
  useEffect(() => {
    mounted.current = true;
    const engine = createTracker({ geo: navigator.geolocation, wakeLock: navigator.wakeLock, onChange: setTrack }); tracker.current = engine;
    const timer = setInterval(() => engine.tick(), 1000);
    return () => { mounted.current = false; clearInterval(timer); engine.dispose(); };
  }, [user.id]);
  useEffect(() => {
    const hide = () => { if (document.hidden && active) tracker.current.stop('화면이 숨겨져 측정을 종료했어요. 수집된 구간을 저장해 주세요.'); };
    document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide);
  }, [active]);
  const guardDialog = useLeaveGuard(() => !discardConfirmed.current && (active || Boolean(track.points.length && !savedId.current && !kept.current)), active ? '화면을 나가면 GPS 측정이 끝나고 저장하지 않은 경로는 사라져요. 나갈까요?' : '아직 저장하지 않은 측정 결과가 있어요. 저장하지 않고 나갈까요?');
  async function save(later = false) {
    if (lock.current || !token) return; lock.current = true; setBusy(true); setError('');
    // Keep both writes tied to the account that started saving.
    const capturedToken = token;
    const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY,
      { accessToken: async () => capturedToken });
    try {
      if (!measurementId.current) measurementId.current = crypto.randomUUID();
      if (!kept.current) {
        await saveGpsDraft(db, measurementId.current, sport, track, note);
        if (!mounted.current) return;
        kept.current = true;
      }
      if (!later && !savedId.current) {
        const id = await finalizeGpsDraft(db, measurementId.current, note);
        if (!mounted.current) return;
        savedId.current = id;
      }
      await cache.invalidateQueries({ queryKey: queryKeys.gpsDraftsRoot(user.id) });
      if (!mounted.current) return;
      if (later) { navigate('/activities', { replace: true }); return; }
      await Promise.all([cache.invalidateQueries({ queryKey: queryKeys.activitiesRoot(user.id) }), cache.invalidateQueries({ queryKey: queryKeys.dashboardRoot(user.id) }), cache.invalidateQueries({ queryKey: queryKeys.attachmentChoices(user.id) }), cache.invalidateQueries({ queryKey: queryKeys.memberRoot(user.id) })]);
      if (!mounted.current) return;
      navigate(`/activities/${savedId.current}`, { replace: true });
    } catch (cause) { if (mounted.current) setError(cause.message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const seconds = Math.floor(track.elapsed / 1000);
  const canSave = track.points.length >= 2 && track.elapsed >= 1000;
  return <main className={`tracking-page ${active ? 'tracking-active' : ''}`}>
    {guardDialog}
    <header className="measurement-heading"><h1>{track.status === 'idle' ? 'GPS 측정' : `${SPORT_LABEL[sport]} ${active ? '측정 중' : '측정 결과'}`}</h1></header>
    {track.status === 'idle' && <><fieldset className="tracking-sports"><legend>운동 선택</legend>{TRACKING_SPORTS.map(value=><label key={value} data-selected={sport===value}><input type="radio" name="tracking-sport" value={value} checked={sport===value} onChange={()=>setSport(value)} /><SportIcon sport={value}/><strong>{SPORT_LABEL[value]}</strong></label>)}</fieldset>
      <div className="measurement-prep"><p>야외에서 이용해 주세요. 첫 위치를 찾으면 측정이 시작돼요.</p><p><strong>화면을 잠그거나 다른 앱으로 이동하면 측정이 끝나요.</strong> 새로고침하거나 나가기 전에는 저장해 주세요.</p></div>
      <button className="btn btn-primary" disabled={!sport} onClick={() => { setError(''); measurementId.current = crypto.randomUUID(); kept.current = false; tracker.current.start(sport); }}>{sport ? `${SPORT_LABEL[sport]} 측정 시작` : '종목을 선택해 주세요'}</button><Link className="tracking-secondary" to="/activities">기록 목록으로</Link></>}
    {track.status !== 'idle' && <dl className="tracking-metrics"><div><dt>운동 시간</dt><dd>{String(Math.floor(seconds / 3600)).padStart(2, '0')}:{String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</dd></div><div><dt>이동 거리</dt><dd>{(track.distance / 1000).toFixed(2)} <small>km</small></dd></div></dl>}
    {track.message && !['GPS 수집 중','측정을 종료했어요. 기록을 저장해 주세요.'].includes(track.message) && <p role="status">{track.message}</p>}
    {active && <><p>{track.awake ? '화면을 잠그거나 다른 앱으로 이동하면 측정이 끝나요.' : '화면이 자동으로 꺼지지 않게 켜 두고, 이 화면에 머물러 주세요.'}</p><button className="btn btn-primary" onClick={() => tracker.current.stop()}>측정 종료</button></>}
    {track.status === 'done' && <><p className="tracking-notice">{kept.current ? '계정에 보관했어요. 운동 기록 저장을 다시 시도할 수 있어요.' : canSave ? '아직 저장하지 않은 결과예요.' : '이동 경로가 부족해 저장할 수 없어요. 야외에서 다시 측정해 주세요.'}</p><RouteMap points={track.points} /><label>운동 메모 <small>선택</small><textarea value={note} maxLength={1000} disabled={busy || kept.current} onChange={event => setNote(event.target.value)} /></label>
      {kept.current && <p>메모는 운동 기록으로 저장한 뒤 수정할 수 있어요.</p>}
      <div className="tracking-actions measurement-save-actions"><button className="btn btn-primary" disabled={busy || !canSave} onClick={()=>save(false)}>{busy ? '저장 중…' : '운동 기록으로 저장'}</button>
      <button className="btn btn-ghost" disabled={busy || Boolean(savedId.current) || !canSave} onClick={()=>save(true)}>측정 결과만 보관</button></div><p className="tracking-help">결과만 보관하면 나중에 작성할 수 있어요. 운동 기록으로 저장해야 목표·통계에 반영돼요.</p>
      <p className="tracking-help">경로는 나만 볼 수 있어요. 경로 공유를 켠 게시글에서는 글의 공개 범위를 따라요.</p>
      <button className="btn btn-ghost" disabled={busy} onClick={() => kept.current ? navigate('/activities', {replace:true}) : setDiscard(true)}>{kept.current ? '보관한 측정 목록으로' : '저장하지 않고 나가기'}</button>
      {discard && <div role="group" aria-label="측정 기록 버리기 확인"><p>수집한 위치와 측정 기록을 버릴까요?</p><button className="btn btn-ghost" disabled={busy} onClick={() => setDiscard(false)}>계속 보기</button><button className="btn btn-ghost" disabled={busy} onClick={() => { discardConfirmed.current = true; navigate('/activities', { replace: true }); }}>기록 버리고 나가기</button></div>}
    </>}
    {error && <div role="alert"><p>{error}</p><a href="/activities" target="_blank" rel="noreferrer">새 탭에서 운동 목록 확인</a></div>}
  </main>;
}
