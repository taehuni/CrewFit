import { Capacitor } from '@capacitor/core';
import { supabase } from '../../shared/supabaseClient.js';
import { createNativeAuth } from './nativeAuth.js';

let bridge;
async function getBridge() {
  if (!bridge) {
    const { Browser } = await import('@capacitor/browser');
    bridge = createNativeAuth({ auth: supabase.auth, storage: localStorage,
      open: options => Browser.open(options), close: () => Browser.close(),
      navigate: path => window.location.replace(path),
    });
  }
  return bridge;
}
export async function startNativeGoogleLogin(next) {
  return (await getBridge()).start(next);
}
export async function sendNativeAuthEmail(kind, send) {
  return (await getBridge()).requestEmail(kind, send);
}
export async function initializeNativeAuth() {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  const handler = await getBridge();
  await App.addListener('appUrlOpen', ({ url }) => { void handler.receive(url); });
  const launch = await App.getLaunchUrl();
  if (launch?.url) await handler.receive(launch.url);
}
