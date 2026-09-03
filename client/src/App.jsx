import { useEffect, useState } from 'react';

// 스캐폴딩 확인용 화면. 서버 /health 로 연결 상태만 표시.
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  const [status, setStatus] = useState('확인 중...');

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((d) => setStatus(d.ok ? '서버 연결됨 ✅' : '응답 이상'))
      .catch(() => setStatus('서버 연결 안됨 ❌ (server 켰는지 확인)'));
  }, []);

  return (
    <main className="app">
      <h1>크루핏 🏃</h1>
      <p className="status">{status}</p>
    </main>
  );
}
