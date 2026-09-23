// Capture before the SDK consumes the URL fragment. Never retain token values.
export function readAuthLink(href) {
  const url = new URL(href);
  const params = new URLSearchParams(url.search);
  for (const [key, value] of new URLSearchParams(url.hash.slice(1))) params.set(key, value);
  return {
    present: ['access_token', 'code', 'error', 'error_code', 'error_description'].some(key => params.has(key)),
    recovery: params.get('type') === 'recovery' || url.pathname === '/reset-password',
    error: params.has('error') || params.has('error_code') || params.has('error_description'),
  };
}

export const initialAuthLink = typeof window === 'undefined'
  ? { present: false, recovery: false, error: false }
  : readAuthLink(window.location.href);

export function confirmationRedirect(origin) {
  return new URL('/auth/callback', origin).href;
}

export async function signupWithEmail(auth, { email, password, nickname, real_name }, origin) {
  const result = await auth.signUp({ email: email.trim(), password,
    options: { data: { nickname, real_name }, emailRedirectTo: confirmationRedirect(origin) } });
  if (result.error) throw result.error;
  return result.data?.session ? 'signed-in' : 'check-email';
}

export async function resendConfirmation(auth, email, origin) {
  const { error } = await auth.resend({ type: 'signup', email: email.trim(),
    options: { emailRedirectTo: confirmationRedirect(origin) } });
  if (error) throw error;
}
