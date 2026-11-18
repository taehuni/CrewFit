import { safeAuthNext } from './googleAuth.js';

export const NATIVE_AUTH_REDIRECT = 'com.crewfit.app://auth/google';
export const NATIVE_EMAIL_REDIRECT = 'com.crewfit.app://auth/email';
export const NATIVE_RECOVERY_REDIRECT = 'com.crewfit.app://auth/recovery';
const KEY = 'crewfit-native-login';
const TTL = 15 * 60 * 1000;
const EMAIL_TTL = 60 * 60 * 1000;

export function createNativeAuth({ auth, storage, open, close, navigate, now = Date.now }) {
  let exchanging = false;
  return {
    async start(next) {
      if (exchanging) return;
      storage.setItem(KEY, JSON.stringify({ at: now(), next: safeAuthNext(next), kind: 'google' }));
      try {
        const { data, error } = await auth.signInWithOAuth({ provider: 'google', options: {
          redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        } });
        if (error || !data?.url || new URL(data.url).protocol !== 'https:') throw new Error();
        await open({ url: data.url });
      } catch {
        storage.removeItem(KEY);
        throw new Error('구글 로그인을 시작하지 못했어요. 다시 시도해 주세요.');
      }
    },
    async requestEmail(kind, send) {
      if (!['email', 'recovery'].includes(kind) || exchanging) throw new Error('잠시 후 다시 시도해 주세요.');
      const pending = JSON.stringify({ at: now(), kind, next: kind === 'recovery' ? '/reset-password' : '/home' });
      storage.setItem(KEY, pending);
      try {
        const result = await send(kind === 'recovery' ? NATIVE_RECOVERY_REDIRECT : NATIVE_EMAIL_REDIRECT);
        if (result === 'signed-in') storage.removeItem(KEY);
        return result;
      } catch (error) {
        if (storage.getItem(KEY) === pending) storage.removeItem(KEY);
        throw error;
      }
    },
    async receive(raw) {
      let url;
      try { url = new URL(raw); } catch { return false; }
      const kind = { '/google': 'google', '/email': 'email', '/recovery': 'recovery' }[url.pathname];
      if (url.protocol !== 'com.crewfit.app:' || url.hostname !== 'auth' || !kind) return false;
      if (exchanging) return true;
      let pending;
      try { pending = JSON.parse(storage.getItem(KEY)); } catch { /* invalid pending state */ }
      const failedPath = kind === 'recovery' ? '/forgot?nativeAuth=failed' : kind === 'email' ? '/verify-email?nativeAuth=failed' : '/login?nativeAuth=failed';
      if (!pending || (pending.kind || 'google') !== kind) { if (kind !== 'google') navigate(failedPath); return true; }
      exchanging = true;
      storage.removeItem(KEY);
      try {
        const codes = url.searchParams.getAll('code');
        const flowIds = url.searchParams.getAll('sb_flow_id');
        if (url.username || url.password || url.port || url.hash || ['error','error_code','error_description'].some(key => url.searchParams.has(key)) ||
          codes.length !== 1 || !codes[0] || codes[0].length > 4096 ||
          flowIds.length > 1 || (flowIds.length === 1 && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowIds[0])) ||
          !Number.isFinite(pending.at) || now() - pending.at > (kind === 'google' ? TTL : EMAIL_TTL) || now() < pending.at) throw new Error();
        // The SDK's locally stored PKCE verifier binds this code to the initiated login.
        const { data, error } = await auth.exchangeCodeForSession(codes[0], flowIds[0] ? { flowId: flowIds[0] } : undefined);
        if (error || !data?.session) throw new Error();
        try { await close(); } catch { /* Android custom tab may already be closed. */ }
        navigate(kind === 'recovery' ? '/reset-password' : safeAuthNext(pending.next));
      } catch {
        try { await close(); } catch { /* best effort */ }
        navigate(failedPath);
      } finally { exchanging = false; }
      return true;
    },
  };
}
