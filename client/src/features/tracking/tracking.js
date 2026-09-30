export const TRACKING_SPORTS = ['running', 'walking', 'cycling'];
export const MAX_POINTS = 10000;
export const GAP_MS = 30000;
export function distanceBetween(a, b) {
  const rad = Math.PI / 180, dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function validPoint(p) {
  return Array.isArray(p) && p.length === 3 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180 && p[2] > 0;
}
export function acceptPosition(position, previous, sport, now = Date.now()) {
  const c = position?.coords, p = [c?.latitude, c?.longitude, position?.timestamp];
  if (!TRACKING_SPORTS.includes(sport) || !validPoint(p) || !Number.isFinite(c.accuracy) || c.accuracy < 0 || c.accuracy > 50 || now - p[2] > 20000 || p[2] > now + 2000) return null;
  if (!previous) return { point: p, distance: 0 };
  const dt = p[2] - previous[2];
  if (dt <= 0) return null;
  const distance = distanceBetween(previous, p);
  if (dt > GAP_MS) return { point: p, distance: 0 };
  const speedLimit = { walking: 6, running: 12, cycling: 35 }[sport];
  if (distance / (dt / 1000) > speedLimit) return null;
  // Ignore sub-3m jitter; the next fix is still compared with the last retained point.
  if (distance < 3) return null;
  return { point: p, distance };
}
export function routeSegments(points) {
  if (!Array.isArray(points) || points.length > MAX_POINTS || points.some(p => !validPoint(p))) return [];
  const segments = [];
  for (const point of points) {
    const previous = segments.at(-1)?.at(-1);
    if (!previous || point[2] - previous[2] > GAP_MS || point[2] <= previous[2]) segments.push([point]);
    else segments.at(-1).push(point);
  }
  return segments;
}
export function trackingPayload(sport, track, note = '') {
  if (!TRACKING_SPORTS.includes(sport)) throw new Error('러닝·걷기·자전거만 GPS 기록을 만들 수 있어요.');
  if (!Array.isArray(track.points) || track.points.length < 2 || !routeSegments(track.points).length) throw new Error('정확한 위치가 2개 이상 필요해요. 야외에서 이동한 뒤 다시 기록해 주세요.');
  if (!Number.isFinite(track.elapsed) || track.elapsed < 1000 || track.elapsed > 21600000 || !Number.isFinite(track.distance) || track.distance < 0) throw new Error('측정 시간과 거리를 확인해 주세요.');
  if (typeof note !== 'string' || note.trim().length > 1000) throw new Error('메모는 1,000자 이하로 입력해 주세요.');
  const started = track.points[0][2];
  return { p_sport: sport, p_performed_on: new Date(started + 9 * 3600000).toISOString().slice(0, 10), p_started_at: new Date(started).toISOString(),
    p_duration_sec: Math.floor(track.elapsed / 1000), p_distance_m: Math.round(track.distance), p_details: {}, p_note: note.trim() || null, p_points: track.points };
}
export async function saveTrackedActivity(db, sport, track, note) {
  const { data, error } = await db.rpc('save_tracked_activity', trackingPayload(sport, track, note));
  if (error || !/^[1-9]\d*$/.test(String(data))) throw new Error('저장 결과를 확인하지 못했어요. 측정 내용은 유지됩니다. 재시도 전 운동 목록에서 같은 기록이 저장됐는지 확인해 주세요.');
  return String(data);
}
export function createTracker({ geo, wakeLock, now = () => performance.now(), wallNow = Date.now, onChange }) {
  let active = false, generation = 0, watch = null, wake = null, started = null, state;
  const fresh = () => ({ status: 'idle', points: [], elapsed: 0, distance: 0, message: '', awake: false });
  state = fresh();
  const emit = () => onChange({ ...state, points: [...state.points] });
  function cleanup() {
    active = false; generation++;
    if (watch != null) geo.clearWatch(watch); watch = null;
    if (wake) { Promise.resolve(wake.release()).catch(() => {}); wake = null; }
    state.awake = false;
  }
  function tick() { if (active && started != null) { state.elapsed = Math.min(21600000, Math.max(0, now() - started)); if (state.elapsed >= 21600000) return stop('6시간 측정 한도에 도달해 종료했어요.'); emit(); } }
  function stop(message = '') {
    tickElapsed(); cleanup(); state.status = state.points.length ? 'done' : 'idle'; state.message = message || (!state.points.length ? '수집된 위치가 없어요. 야외에서 다시 시작해 주세요.' : '측정을 종료했어요. 기록을 저장해 주세요.'); emit();
  }
  function tickElapsed() { if (active && started != null) state.elapsed = Math.min(21600000, Math.max(0, now() - started)); }
  function start(sport) {
    if (active) return;
    if (!TRACKING_SPORTS.includes(sport) || !geo) { state = { ...fresh(), message: '이 브라우저에서 GPS를 사용할 수 없어요.' }; emit(); return; }
    cleanup(); state = { ...fresh(), status: 'waiting', message: '정확한 위치를 기다리고 있어요.' }; started = null; active = true; const token = generation; emit();
    try {
      watch = geo.watchPosition(position => {
        if (!active || generation !== token) return;
        const accepted = acceptPosition(position, state.points.at(-1), sport, wallNow());
        if (!accepted) { state.message = '위치가 부정확하거나 이동이 작아 다음 위치를 기다리고 있어요.'; emit(); return; }
        if (started == null) started = now();
        state.points.push(accepted.point); state.distance += accepted.distance; state.status = 'running'; state.message = 'GPS 수집 중'; tickElapsed(); emit();
        if (state.points.length >= MAX_POINTS) stop('경로 수집 한도에 도달해 종료했어요.');
      }, error => {
        if (!active || generation !== token) return;
        if (error.code === 1) stop('위치 권한이 거부됐어요. 브라우저의 위치 권한을 확인해 주세요.');
        else { state.message = 'GPS 신호를 확인할 수 없어요. 야외에서 기다리거나 측정을 종료해 주세요.'; emit(); }
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
      if (!active && watch != null) { geo.clearWatch(watch); watch = null; }
    } catch { stop('위치 수집을 시작하지 못했어요. HTTPS 연결과 위치 권한을 확인해 주세요.'); }
    if (active && wakeLock) Promise.resolve().then(() => wakeLock.request('screen')).then(lock => {
      if (!active || generation !== token) { void lock.release().catch(() => {}); return; }
      wake = lock; state.awake = true; emit();
      lock.addEventListener('release', () => { if (generation === token) { state.awake = false; emit(); } });
    }).catch(() => { if (active && generation === token) { state.awake = false; emit(); } });
  }
  return { start, stop, tick, dispose: cleanup };
}
