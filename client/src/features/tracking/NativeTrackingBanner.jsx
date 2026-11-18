import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { isNativeTracking, nativeTracking } from './nativeTracking.js';
import './native-tracking.css';

export default function NativeTrackingBanner({ userId }) {
  const [status, setStatus] = useState('idle');
  useEffect(() => {
    if (!isNativeTracking() || !userId) return;
    let disposed = false, pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try { const result = await nativeTracking.snapshot(userId, true); if (!disposed) setStatus(result.status); }
      catch { if (!disposed) setStatus('idle'); }
      finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    window.addEventListener('crewfit:gps-change', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('crewfit:gps-change', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [userId]);
  if (status === 'idle') return null;
  return <Link className="native-gps-banner" to="/activities/track"><span><strong>{status === 'done' ? '저장하지 않은 GPS 측정' : 'GPS 측정 중'}</strong><small>{status === 'done' ? '남겨둔 경로를 확인하고 저장하세요.' : '화면을 꺼도 측정을 이어가요.'}</small></span><b>{status === 'done' ? '결과 확인' : '측정 화면'} →</b></Link>;
}
