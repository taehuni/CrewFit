export function safeAuthNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return '/home';
  const url = new URL(value, 'https://crewfit.invalid');
  if (url.origin !== 'https://crewfit.invalid' || !/^\/(home|activities|crews|feed|me|goals|meals|feedback|notifications)(\/|$)/.test(url.pathname)) return '/home';
  return url.pathname + url.search + url.hash;
}

export async function startGoogleLogin(auth, { origin, next = '/home' }) {
  const redirect = new URL('/auth/google', origin);
  redirect.searchParams.set('next', safeAuthNext(next));
  const { error } = await auth.signInWithOAuth({ provider: 'google', options: {
    redirectTo: redirect.href, queryParams: { prompt: 'select_account' },
  } });
  if (error) throw new Error('구글 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
}
