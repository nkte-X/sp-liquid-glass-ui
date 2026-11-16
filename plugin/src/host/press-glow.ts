// Press glow: while a finger/pointer is down on a glass control, a soft light
// pool follows it (iOS 26 glass "illuminates from within" on touch). The CSS
// lives in style.ts; this only tracks the pointer and sets --lgx-px/--lgx-py.

import type { Disposer } from './disposer';
import { SEL } from './env';

const PRESS_CLASS = 'lgx-pressing';

export const startPressGlow = (d: Disposer): void => {
  let active: HTMLElement | null = null;
  let pointerId = -1;

  const place = (el: HTMLElement, x: number, y: number): void => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--lgx-px', `${x - r.left}px`);
    el.style.setProperty('--lgx-py', `${y - r.top}px`);
  };

  const release = (): void => {
    if (!active) return;
    active.classList.remove(PRESS_CLASS);
    active.style.removeProperty('--lgx-px');
    active.style.removeProperty('--lgx-py');
    active = null;
    pointerId = -1;
  };

  d.listen(
    document,
    'pointerdown',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const el = t.closest<HTMLElement>(SEL.glowTargets);
      if (!el) return;
      release();
      active = el;
      pointerId = e.pointerId;
      place(el, e.clientX, e.clientY);
      el.classList.add(PRESS_CLASS);
    },
    { capture: true, passive: true },
  );

  d.listen(
    document,
    'pointermove',
    (e) => {
      if (active && e.pointerId === pointerId) place(active, e.clientX, e.clientY);
    },
    { capture: true, passive: true },
  );

  for (const type of ['pointerup', 'pointercancel'] as const) {
    d.listen(
      document,
      type,
      (e) => {
        if (e.pointerId === pointerId) release();
      },
      { capture: true, passive: true },
    );
  }
  d.listen(window, 'blur', release);
  d.add(release);
};
