import { useEffect, useRef } from 'react';

const clamp = value => Math.min(1, Math.max(0, value));
// Layout coordinates deliberately exclude transforms, preventing scroll feedback.
function layoutTop(element) {
  let top = 0;
  for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
  return top;
}
export function useIntroMotion(ready) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!ready || !root) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const targets = [...root.querySelectorAll('.intro-section-heading, .intro-usecases, .intro-feature-row > *, .intro-next, .intro-how > h2, .intro-how li, .intro-faq, .intro-final')];
    const bars = [...root.querySelectorAll('.intro-bars span[data-active="true"]')];
    const chart = root.querySelector('.intro-bars');
    const hero = root.querySelector('.intro-giant');
    let frame = 0;
    let positions = [];
    let chartTop = 0;
    let visualScroll = window.scrollY;
    let previousTime = 0;
    const measure = () => {
      positions = targets.map(layoutTop);
      chartTop = chart ? layoutTop(chart) : 0;
    };
    const update = (time = performance.now()) => {
      frame = 0;
      const viewport = window.innerHeight;
      const actualScroll = window.scrollY;
      const elapsed = previousTime ? Math.min(64, time - previousTime) : 16;
      previousTime = time;
      const delta = actualScroll - visualScroll;
      visualScroll = preference.matches || Math.abs(delta) < .5
        ? actualScroll
        : visualScroll + delta * (1 - Math.exp(-elapsed / 180));
      const scroll = visualScroll;
      const height = document.documentElement.scrollHeight - viewport;
      root.style.setProperty('--intro-progress', String(height > 0 ? clamp(actualScroll / height) : 0));
      root.classList.toggle('intro-scrolled', scroll > 24);
      const reduced = preference.matches;
      const distance = window.innerWidth <= 760 ? 30 : 64;
      targets.forEach((el, index) => {
        const focused = el.contains(document.activeElement);
        const progress = reduced || focused ? 1 : clamp((viewport * .94 - (positions[index] - scroll)) / (viewport * .42));
        el.style.setProperty('--reveal-y', `${(1 - progress) * distance}px`);
        el.style.setProperty('--reveal-opacity', String(.28 + .72 * progress));
        el.style.setProperty('--reveal-scale', String(.96 + .04 * progress));
      });
      const graphProgress = reduced ? 1 : clamp((viewport * .82 - (chartTop - scroll)) / (viewport * .58));
      bars.forEach((bar, index) => {
        const progress = reduced ? 1 : clamp((graphProgress - index * .12) / .76);
        bar.style.setProperty('--bar-fill', String(.04 + .96 * progress));
      });
      if (Math.abs(actualScroll - visualScroll) >= .5) frame = requestAnimationFrame(update);
      hero?.style.setProperty('--hero-y', `${reduced ? 0 : Math.min(scroll * .12, 45)}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = () => { measure(); schedule(); };
    targets.forEach(el => el.classList.add('intro-scroll-item'));
    root.classList.add('intro-motion');
    measure();
    update();
    preference.addEventListener('change', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize);
    root.addEventListener('focusin', schedule);
    root.addEventListener('focusout', schedule);
    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    observer?.observe(root);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', resize);
      root.removeEventListener('focusin', schedule);
      root.removeEventListener('focusout', schedule);
      root.classList.remove('intro-motion');
      targets.forEach(el => {
        el.classList.remove('intro-scroll-item');
        ['--reveal-y', '--reveal-opacity', '--reveal-scale'].forEach(name => el.style.removeProperty(name));
      });
      bars.forEach(bar => bar.style.removeProperty('--bar-fill'));
      hero?.style.removeProperty('--hero-y');
    };
  }, [ready]);
  return ref;
}

