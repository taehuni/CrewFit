// Express /api 호출. 개발은 Vite 프록시(/api → 4000), 배포는 VITE_API_URL.
// 서버 에러 형식 { error: { code, message } } → Error(message)로 변환.
const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, { token, body, ...init } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    method: init.method || (body ? 'POST' : 'GET'),
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `요청에 실패했어요 (${res.status})`);
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}
