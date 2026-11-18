import { TRACKING_SPORTS, MAX_POINTS, validPoint } from './tracking.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const emptyNativeTrack = () => ({ status: 'idle', points: [], elapsed: 0, distance: 0, message: '', awake: false });
export function normalizeNativeSnapshot(value, summaryOnly = false) {
  if (value?.status === 'idle') return emptyNativeTrack();
  if (!value || !['waiting', 'running', 'done'].includes(value.status) || !UUID.test(value.sessionId) ||
    !TRACKING_SPORTS.includes(value.sport) || !Number.isFinite(value.elapsed) || value.elapsed < 0 || value.elapsed > 21600000 ||
    !Number.isFinite(value.distance) || value.distance < 0) throw new Error('측정 상태를 확인하지 못했어요. 다시 확인해 주세요.');
  const points = summaryOnly ? [] : value.points;
  if (!Array.isArray(points) || points.length > MAX_POINTS || points.some((p, i) => !validPoint(p) || (i > 0 && p[2] <= points[i - 1][2]))) {
    throw new Error('경로를 불러오지 못했어요. 기기의 측정 결과는 유지됩니다.');
  }
  return { status: value.status, sessionId: value.sessionId, sport: value.sport, points,
    elapsed: value.elapsed, distance: value.distance, awake: false, notificationsEnabled: value.notificationsEnabled === true,
    message: typeof value.message === 'string' ? value.message.slice(0, 300) : '' };
}
export function nativeTrackingError(error) {
  const messages = {
    OWNER_MISMATCH: '이 기기에 다른 계정의 측정이 남아 있어요. 측정한 계정으로 로그인해 결과를 저장하거나 삭제해 주세요.',
    PERMISSION_DENIED: '정확한 위치 권한이 필요해요. 앱의 위치 권한을 확인한 뒤 다시 시작해 주세요.',
    LOCATION_PERMISSION_DENIED: '정확한 위치 권한이 필요해요. 앱의 위치 권한을 확인한 뒤 다시 시작해 주세요.',
    LOCATION_DISABLED: '휴대폰의 위치 기능을 켠 뒤 다시 시작해 주세요.',
    SESSION_EXISTS: '저장하지 않은 측정이 남아 있어요. 먼저 결과를 확인해 주세요.',
  };
  return new Error(messages[error?.code] || 'GPS 요청을 완료하지 못했어요. 측정 상태를 다시 확인해 주세요.');
}
export function createNativeTrackingClient(plugin, changed = () => {}) {
  const call = async (name, args, summaryOnly = false) => {
    try { const result = normalizeNativeSnapshot(await plugin[name](args), summaryOnly); if (name !== 'snapshot') changed(); return result; }
    catch (error) { throw nativeTrackingError(error); }
  };
  const owner = id => { if (!UUID.test(id)) throw new Error('로그인 후 GPS를 이용해 주세요.'); return id; };
  return {
    snapshot: (ownerId, summaryOnly = false) => call('snapshot', { ownerId: owner(ownerId), summaryOnly }, summaryOnly),
    start: (ownerId, sessionId, sport) => {
      if (!UUID.test(sessionId) || !TRACKING_SPORTS.includes(sport)) throw new Error('운동 종목을 선택해 주세요.');
      return call('start', { ownerId: owner(ownerId), sessionId, sport });
    },
    stop: ownerId => call('stop', { ownerId: owner(ownerId) }),
    clear: (ownerId, sessionId) => {
      if (!UUID.test(sessionId)) throw new Error('측정 결과를 다시 확인해 주세요.');
      return call('clear', { ownerId: owner(ownerId), sessionId });
    },
    suspend: async () => { try { await plugin.suspend(); changed(); } catch { throw nativeTrackingError(); } },
  };
}
