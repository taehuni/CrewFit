import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../auth/index.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORT_LABEL } from '../../shared/ui.jsx';
import useLeaveGuard from '../../shared/useLeaveGuard.jsx';
import { TRACKING_SPORTS } from './tracking.js';
import { nativeTracking } from './nativeTracking.js';
import { emptyNativeTrack } from './nativeTrackingClient.js';
import { saveGpsDraft, finalizeGpsDraft, loadGpsDraft } from './drafts.js';
import RouteMap from './RouteMap.jsx';
import SportIcon from '../../shared/SportIcon.jsx';
import './native-tracking.css';

export default function NativeTrackingPage() {
  const { user, token } = useAuth(), cache = useQueryClient(), navigate = useNavigate(), [params] = useSearchParams();
  const [sport, setSport] = useState(TRACKING_SPORTS.includes(params.get('sport')) ? params.get('sport') : '');
  const [track, setTrack] = useState(emptyNativeTrack), [ready, setReady] = useState(false);
  const [restoredSession, setRestoredSession] = useState(null), [restoreError, setRestoreError] = useState(false), [restoreAttempt, setRestoreAttempt] = useState(0);
  const [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [discard, setDiscard] = useState(false);
  const mounted = useRef(false), lock = useRef(false), polling = useRef(false), revision = useRef(0);
  const kept = useRef(false), savedId = useRef(null), discardConfirmed = useRef(false);
  const active = track.status === 'waiting' || track.status === 'running';
  const guardDialog = useLeaveGuard(() => !discardConfirmed.current && Boolean(note.trim()) && !kept.current,
    '경로는 기기에 남지만 작성 중인 메모는 사라져요. 이 화면에서 나갈까요?');

  async function refresh() {
    if (!mounted.current || polling.current || lock.current || document.hidden) return;
    polling.current = true;
    const current = revision.current;
    try {
      const result = await nativeTracking.snapshot(user.id);
      if (mounted.current && current === revision.current) { setTrack(result); setReady(true); }
    } catch (cause) {
      if (mounted.current && current === revision.current) { setReady(false); setError(cause.message); }
    } finally { polling.current = false; }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(refresh, 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => { mounted.current = false; revision.current++; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [user.id]);

  useEffect(() => {
    if (track.status !== 'done' || !token || restoredSession === track.sessionId) return;
    let disposed = false;
    const capturedToken = token, sessionId = track.sessionId;
    const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY,
      { accessToken: async () => capturedToken });
    setRestoreError(false);
    // A previous visit may have saved the draft but failed before clearing the local result.
    // Recover its memo before allowing finalize, whose note argument updates the stored memo.
    loadGpsDraft(db, user.id, sessionId).then(draft => {
      if (disposed || !mounted.current) return;
      kept.current = Boolean(draft);
      savedId.current = draft?.finalized_at && draft?.activity_id ? String(draft.activity_id) : null;
      setNote(draft?.note || '');
      setRestoredSession(sessionId);
    }).catch(() => { if (!disposed && mounted.current) setRestoreError(true); });
    return () => { disposed = true; };
  }, [track.status, track.sessionId, user.id, token, restoredSession, restoreAttempt]);

  async function action(kind) {
    if (lock.current || !ready) return;
    lock.current = true; revision.current++; setBusy(true); setError('');
    try {
      const result = kind === 'start'
        ? await nativeTracking.start(user.id, crypto.randomUUID(), sport)
        : await nativeTracking.stop(user.id);
      if (!mounted.current) return;
      if (kind === 'start') { kept.current = false; savedId.current = null; discardConfirmed.current = false; setDiscard(false); setNote(''); }
      setTrack(result);
    } catch (cause) { if (mounted.current) setError(cause.message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  async function save(later) {
    if (lock.current || !token || !ready || !canSave || restoredSession !== track.sessionId) return;
    lock.current = true; revision.current++; setBusy(true); setError('');
    // The client keeps this operation tied to its original account, even after a session switch.
    const capturedToken = token;
    const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY,
      { accessToken: async () => capturedToken });
    try {
      if (!kept.current) {
        await saveGpsDraft(db, track.sessionId, track.sport, track, note);
        if (!mounted.current) return;
        kept.current = true;
      }
      if (!later && !savedId.current) {
        const id = await finalizeGpsDraft(db, track.sessionId, note);
        if (!mounted.current) return;
        savedId.current = id;
      }
      await cache.invalidateQueries({ queryKey: queryKeys.gpsDraftsRoot(user.id) });
      if (!later) await Promise.all([
        queryKeys.activitiesRoot(user.id), queryKeys.dashboardRoot(user.id),
        queryKeys.attachmentChoices(user.id), queryKeys.memberRoot(user.id),
      ].map(queryKey => cache.invalidateQueries({ queryKey })));
      if (!mounted.current) return;
      await nativeTracking.clear(user.id, track.sessionId);
      if (!mounted.current) return;
      discardConfirmed.current = true;
      navigate(later ? '/activities' : `/activities/${savedId.current}`, { replace: true });
    } catch {
      if (mounted.current) setError('저장 완료를 확인하지 못했어요. 기기의 측정 결과는 유지됩니다. 다시 시도해 주세요.');
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  async function discardLocal() {
    if (lock.current) return;
    lock.current = true; revision.current++; setBusy(true); setError('');
    try {
      await nativeTracking.clear(user.id, track.sessionId);
      if (!mounted.current) return;
      discardConfirmed.current = true;
      navigate('/activities', { replace: true });
    } catch (cause) { if (mounted.current) setError(cause.message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  const seconds = Math.floor(track.elapsed / 1000), canSave = track.status === 'done' && track.points.length >= 2 && track.elapsed >= 1000;
  return <section className={`tracking-page native-tracking ${active ? 'tracking-active' : ''}`}>
    {guardDialog}
    <header className="measurement-heading"><p className="measurement-eyebrow">GPS 운동 기록</p><h1>{track.status === 'idle' ? '오늘은 어떻게 움직일까요?' : active ? `${SPORT_LABEL[track.sport]} 측정 중` : '오늘의 움직임'}</h1><p className="measurement-subtitle">{track.status === 'idle' ? '운동을 고르면 이동한 경로와 시간을 담아드려요.' : active ? '내 페이스에 맞춰 움직여 보세요.' : '이동 경로를 확인하고 기록을 남겨보세요.'}</p></header>
    {!ready && <p role="status">{error ? '측정 상태를 다시 확인해 주세요.' : '기기에 남은 측정을 확인하고 있어요…'}</p>}
    {track.status === 'idle' && <>
      <fieldset className="tracking-sports" disabled={busy || !ready}><legend>운동 선택</legend>{TRACKING_SPORTS.map(value => <label key={value} data-selected={sport === value}><input type="radio" name="native-tracking-sport" checked={sport === value} onChange={() => setSport(value)}/><SportIcon sport={value}/><strong>{SPORT_LABEL[value]}</strong></label>)}</fieldset>
      <div className="measurement-prep"><span className="measurement-eyebrow">시작하기 전에</span><h2>탁 트인 야외에서 시작해 주세요</h2><p>정확한 위치를 허용하면 준비 완료.<br/>첫 위치를 잡으면 시간이 시작돼요.</p><div className="measurement-capabilities"><span>이동 경로</span><span>운동 시간</span><span>이동 거리</span></div></div>
      <button className="btn btn-primary" disabled={!sport || busy || !ready} onClick={() => action('start')}>{busy ? '시작 중…' : sport ? `${SPORT_LABEL[sport]} 측정 시작` : '종목을 선택해 주세요'}</button>
    </>}
    {track.status !== 'idle' && <dl className="tracking-metrics"><div><dt>운동 시간</dt><dd>{String(Math.floor(seconds / 3600)).padStart(2, '0')}:{String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</dd></div><div><dt>이동 거리</dt><dd>{(track.distance / 1000).toFixed(2)} <small>km</small></dd></div></dl>}
    {track.message && <p role="status">{track.message}</p>}
    {active && <><p className="tracking-status">{track.notificationsEnabled ? '화면을 꺼도 측정을 이어가요. 알림에서도 종료할 수 있어요.' : '화면을 꺼도 측정을 이어가요. 종료할 때 이 화면으로 돌아와 주세요.'}</p><button className="btn btn-primary" disabled={busy || !ready} onClick={() => action('stop')}>{busy ? '종료 중…' : '측정 종료'}</button><Link className="tracking-secondary" to="/home">측정은 계속하고 홈으로</Link></>}
    {track.status === 'done' && <>
      <h2 className="measurement-section-title">이동 경로</h2>
      <p className="tracking-notice">{kept.current ? '측정 결과는 계정에 보관했어요. 저장을 다시 시도하면 이어서 완료합니다.' : '경로는 기기에 보관 중이에요. 저장하면 내 기록에서 볼 수 있어요.'}</p>
      <RouteMap points={track.points}/>
      {restoredSession !== track.sessionId && <div role={restoreError ? 'alert' : 'status'}><p>{restoreError ? '계정에 보관한 메모를 확인하지 못했어요. 확인 후 저장을 이어갈 수 있어요.' : '계정에 보관한 측정과 메모를 확인하고 있어요…'}</p>{restoreError && <button className="btn btn-ghost" onClick={() => setRestoreAttempt(value => value + 1)}>보관 상태 다시 확인</button>}</div>}
      <label>운동 메모 <small>선택</small><textarea placeholder="오늘의 컨디션이나 기억하고 싶은 순간" value={note} maxLength={1000} disabled={busy || kept.current || restoredSession !== track.sessionId} onChange={event => setNote(event.target.value)}/></label>
      <p>저장 전 작성한 메모는 이 화면을 나가면 사라져요.</p>
      <div className="tracking-actions measurement-save-actions"><button className="btn btn-primary" disabled={busy || !canSave || !ready || restoredSession !== track.sessionId} onClick={() => save(false)}>{busy ? '처리 중…' : '운동 기록으로 저장'}</button><button className="btn btn-ghost" disabled={busy || Boolean(savedId.current) || !canSave || !ready || restoredSession !== track.sessionId} onClick={() => save(true)}>측정 결과만 보관</button></div>
      <p>나중에 작성하려면 결과만 보관하세요. 운동 기록으로 저장하면 통계에 반영돼요.</p>
      {!canSave && <p className="tracking-notice">저장할 만큼 충분한 이동 경로가 없어요. 야외에서 잠시 이동하며 다시 측정해 주세요.</p>}
      <p>저장한 경로는 기본적으로 나만 볼 수 있어요. 피드에서 경로 공유를 켠 글에 첨부하면 글의 공개 범위를 따릅니다.</p>
      <button className="btn measurement-discard" disabled={busy} onClick={() => setDiscard(true)}>기기에서 측정 삭제</button>
      {discard && <div role="group" aria-label="기기 측정 삭제 확인"><p>기기에 남은 경로와 메모를 삭제할까요? 이미 계정에 저장한 기록은 유지돼요.</p><div className="tracking-actions"><button className="btn btn-ghost" disabled={busy} onClick={() => setDiscard(false)}>계속 보기</button><button className="btn btn-ghost" disabled={busy} onClick={discardLocal}>기기에서 삭제</button></div></div>}
    </>}
    {!active && <Link className="tracking-secondary" to="/activities">기록 목록으로</Link>}
    {error && <div role="alert"><p>{error}</p><button className="btn btn-ghost" disabled={busy} onClick={() => { setError(''); void refresh(); }}>측정 상태 다시 확인</button></div>}
  </section>;
}
