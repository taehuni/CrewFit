import { useEffect, useRef, useState } from 'react';
import { authPhotos as photos, chooseStartPhoto } from './authPhotos.js';

const START_PHOTO_KEY = 'crewfit.auth.start-photo';

function initialPhoto() {
  let previous;
  try { previous = window.sessionStorage.getItem(START_PHOTO_KEY); } catch { /* Storage may be blocked. */ }
  return chooseStartPhoto(previous);
}

// Keep the slideshow's timer/renders independent of the account form.
export default function AuthBackdrop() {
  const [desktop, setDesktop] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(!document.hidden);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState([]);
  const [active, setActive] = useState(initialPhoto);
  const startingPhoto = useRef(active);

  useEffect(() => {
    if (!desktop) return;
    try { window.sessionStorage.setItem(START_PHOTO_KEY, photos[startingPhoto.current].src); } catch { /* Random start still works without storage. */ }
  }, [desktop]);

  useEffect(() => {
    const screen = window.matchMedia('(min-width: 960px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { setDesktop(screen.matches); setReducedMotion(motion.matches); };
    const syncVisibility = () => setVisible(!document.hidden);
    sync();
    screen.addEventListener('change', sync);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      screen.removeEventListener('change', sync);
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (!desktop || reducedMotion || paused || !visible || loaded.length < 2) return;
    const timer = window.setInterval(() => {
      setActive(current => {
        for (let step = 1; step <= photos.length; step++) {
          const next = (current + step) % photos.length;
          if (loaded.includes(next)) return next;
        }
        return current;
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [desktop, reducedMotion, paused, visible, loaded]);

  if (!desktop) return null;
  return (
    <>
      <div className="auth-photos" aria-hidden="true" data-active={active}>
        {photos.map((photo, index) => (
          <img key={photo.src} src={photo.src} alt="" decoding="async" draggable="false"
            className={`auth-photo${active === index ? ' is-active' : ''}`}
            style={{ objectPosition: photo.position }}
            onLoad={() => {
              setLoaded(previous => previous.includes(index) ? previous : [...previous, index]);
            }}
            onError={() => setActive(current => current === index ? (index + 1) % photos.length : current)} />
        ))}
      </div>
      {!reducedMotion && loaded.length > 1 && (
        <button type="button" className="auth-photo-control" onClick={() => setPaused(value => !value)}
          aria-label={paused ? '배경 사진 자동 전환 재생' : '배경 사진 자동 전환 일시정지'}>
          <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
          {paused ? '사진 재생' : '사진 멈춤'}
        </button>
      )}
    </>
  );
}
