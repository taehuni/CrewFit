import {consumeSurfaceBack} from './nativeBack.js';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import { Capacitor } from '@capacitor/core';

export default function NavigationExperience() {
  const location = useLocation(), navigationType = useNavigationType(), navigate = useNavigate();
  const positions = useRef(new Map()), previousPage = useRef(null), resetKey = useRef(null);
  const page = location.pathname + ':' + (new URLSearchParams(location.search).get('view') || '');
  useLayoutEffect(() => {
    const priorRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => { history.scrollRestoration = priorRestoration; };
  }, []);
  useLayoutEffect(() => {
    if (previousPage.current !== page) resetKey.current = location.key;
    let observer, resizeObserver, timeout, firstFrame, secondFrame;
    const cancelRestore = () => { resizeObserver?.disconnect(); cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
    if (location.hash) {
      const jump = () => {
        let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch { return false; }
        const target = document.getElementById(id);
        if (!target) return false;
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        return true;
      };
      if (!jump()) {
        observer = new MutationObserver(() => { if (jump()) observer.disconnect(); });
        observer.observe(document.body, { subtree: true, childList: true });
        timeout = setTimeout(() => observer.disconnect(), 3000);
      }
    } else if (navigationType === 'POP' && positions.current.has(location.key)) {
      const top = positions.current.get(location.key);
      const restore = () => {
        window.scrollTo({ top, behavior: 'instant' });
        if (Math.abs(window.scrollY - top) < 2) resizeObserver?.disconnect();
      };
      restore();
      if (Math.abs(window.scrollY - top) >= 2) {
        resizeObserver = new ResizeObserver(restore);
        resizeObserver.observe(document.body);
        timeout = setTimeout(cancelRestore, 3000);
      }
    } else if (resetKey.current === location.key) {
      const reset = () => window.scrollTo({ top: 0, behavior: 'instant' });
      reset();
      // WebView can anchor to the clicked card while a lazy page mounts.
      // Reapply after layout, stopping as soon as the user interacts.
      firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(reset); });
      resizeObserver = new ResizeObserver(reset);
      resizeObserver.observe(document.body);
      timeout = setTimeout(cancelRestore, 700);
    }
    previousPage.current = page;
    const remember = () => {
      positions.current.set(location.key, window.scrollY);
      if (positions.current.size > 80) positions.current.delete(positions.current.keys().next().value);
    };
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('pointerdown', cancelRestore, { once: true });
    window.addEventListener('wheel', cancelRestore, { once: true, passive: true });
    window.addEventListener('keydown', cancelRestore, { once: true });
    return () => {
      window.removeEventListener('scroll', remember); observer?.disconnect(); cancelRestore(); clearTimeout(timeout);
      window.removeEventListener('pointerdown', cancelRestore); window.removeEventListener('wheel', cancelRestore); window.removeEventListener('keydown', cancelRestore);
    };
  }, [location.key, location.hash, page, navigationType]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false, subscription;
    import('@capacitor/app').then(async ({ App }) => {
      subscription = await App.addListener('backButton', ({ canGoBack }) => {
        if(consumeSurfaceBack(window))return;
        const goBack = () => {
          if (canGoBack) navigate(-1);
          else if (location.pathname !== '/home') navigate('/home', { replace: true });
          else void App.minimizeApp();
        };
        goBack();
      });
      if (disposed) await subscription.remove();
    });
    return () => { disposed = true; void subscription?.remove(); };
  }, [navigate, location.pathname]);
  return null;
}
