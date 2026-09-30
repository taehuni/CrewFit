import { useEffect, useRef, useState } from 'react';
import { routeSegments } from './tracking.js';
import './tracking.css';
let sdkPromise;
function loadMapSdk() {
  const key = import.meta.env.VITE_NAVER_MAP_CLIENT_ID;
  if (!key) return Promise.reject(new Error('map-not-configured'));
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const oldAuthFailure = window.navermap_authFailure;
    const timer = setTimeout(() => fail(), 15000);
    function clean() { clearTimeout(timer); window.navermap_authFailure = oldAuthFailure; delete window.crewfitNaverMapReady; }
    function fail() { if (settled) return; settled = true; clean(); script.remove(); reject(new Error('map-load-failed')); }
    window.navermap_authFailure = fail;
    // The SDK callback can run before the script assigns window.naver.maps.
    window.crewfitNaverMapReady = () => queueMicrotask(() => { if (settled) return; if (!window.naver?.maps?.Map) return fail(); settled = true; clean(); resolve(window.naver.maps); });
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&callback=crewfitNaverMapReady`;
    script.onerror = fail; document.head.appendChild(script);
  }).catch(error => { sdkPromise = null; throw error; });
  return sdkPromise;
}
function RouteOutline({ points }) {
  const segments = routeSegments(points), all = segments.flat();
  if (!all.length) return null;
  const xs = all.map(p => p[1] * Math.cos(all[0][0] * Math.PI / 180)), ys = all.map(p => -p[0]);
  const minX = Math.min(...xs), minY = Math.min(...ys), scale = 260 / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 0.00001);
  const xy = p => [20 + (p[1] * Math.cos(all[0][0] * Math.PI / 180) - minX) * scale, 20 + (-p[0] - minY) * scale];
  return <svg className="route-outline" viewBox="0 0 300 300" role="img" aria-label="지도 배경 없는 GPS 경로 미리보기">{segments.map((segment, i) => <polyline key={i} points={segment.map(p => xy(p).join(',')).join(' ')} fill="none" stroke="#ff550a" strokeWidth="3" />)}<circle cx={xy(all[0])[0]} cy={xy(all[0])[1]} r="5" fill="#20252c" /><circle cx={xy(all.at(-1))[0]} cy={xy(all.at(-1))[1]} r="5" fill="#ff550a" /></svg>;
}
export default function RouteMap({ points }) {
  const target = useRef(null), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false, observer, map; const overlays = []; setError(false);
    const segments = routeSegments(points); if (!segments.length) { setError(true); return; }
    loadMapSdk().then(maps => {
      if (cancelled) return;
      const first = segments[0][0]; map = new maps.Map(target.current, { center: new maps.LatLng(first[0], first[1]), zoom: 15 });
      const bounds = new maps.LatLngBounds();
      for (const segment of segments) { const path = segment.map(p => new maps.LatLng(p[0], p[1])); path.forEach(p => bounds.extend(p)); overlays.push(new maps.Polyline({ map, path, strokeWeight: 5, strokeColor: '#ff550a', strokeOpacity: 0.9 })); }
      const all = segments.flat(); for (const point of [all[0], all.at(-1)]) overlays.push(new maps.Marker({ map, position: new maps.LatLng(point[0], point[1]) }));
      let previousSize = '';
      const fit = () => { const { offsetWidth: width, offsetHeight: height } = target.current; if (!width || !height || previousSize === `${width}:${height}`) return; previousSize = `${width}:${height}`; map.setSize(new maps.Size(width, height)); map.fitBounds(bounds); }; fit();
      observer = new ResizeObserver(fit); observer.observe(target.current);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; observer?.disconnect(); overlays.forEach(overlay => overlay.setMap(null)); map?.destroy(); };
  }, [points, attempt]);
  return <div className="route-preview"><div ref={target} className="route-map" hidden={error} role="img" aria-label="GPS 운동 경로 지도" />{error && <><p>지도를 불러올 수 없어 경로 모양을 표시합니다.</p><RouteOutline points={points} /><button type="button" className="btn btn-ghost" onClick={() => setAttempt(n => n + 1)}>지도 다시 불러오기</button></>}<p className="muted">수신이 30초 넘게 끊긴 구간은 연결하지 않습니다.</p></div>;
}
