export function isMobileTrackingDevice(device = {}) {
  const ua = device.userAgent || '';
  if (device.userAgentData?.mobile === true) return true;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && device.maxTouchPoints > 1);
}

export function trackingHandoffUrl(origin, sport = '') {
  const base = new URL(origin);
  const local = base.hostname === 'localhost' || base.hostname === '127.0.0.1' || base.hostname === '[::1]' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(base.hostname);
  const url = new URL('/activities/track', local ? 'https://crewfit-akvt.onrender.com' : base.origin);
  if (['running', 'walking', 'cycling'].includes(sport)) url.searchParams.set('sport', sport);
  return url.href;
}
