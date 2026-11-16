// Tab bar minimize on scroll, like iOS 26 `tabBarMinimizeBehavior(.onScrollDown)`.
//
// Scroll events don't bubble, so one capture-phase listener on the document
// sees every scroll container. Scrolling down past a threshold collapses the
// capsule to the selected tab; scrolling up, reaching the top, tapping the
// bar or switching context expands it again.

import type { Disposer } from './disposer';
import { SEL, hasTabBar } from './env';

const MIN_CLASS = 'lgx-tabbar-min';
const TOP_ZONE = 24; // px from top where the bar is always expanded
const DOWN_DISTANCE = 28; // accumulated px down before collapsing
const UP_DISTANCE = 14; // accumulated px up before expanding
const MIN_SCROLL_RANGE = 120; // ignore containers that barely scroll

export interface TabBarControl {
  expand(): void;
}

export const startTabBarMinimize = (d: Disposer): TabBarControl => {
  const body = document.body;
  const lastTop = new WeakMap<Element, number>();
  let acc = 0;
  let frame = 0;
  let pending: Element | null = null;

  const setMin = (on: boolean): void => {
    // Without a selected tab the collapsed capsule would be empty.
    if (on && !document.querySelector(SEL.tabButtonActive)) on = false;
    body.classList.toggle(MIN_CLASS, on);
  };

  const evaluate = (): void => {
    frame = 0;
    const el = pending;
    pending = null;
    if (!el || !hasTabBar()) return;

    const top = el.scrollTop;
    const prev = lastTop.get(el);
    lastTop.set(el, top);
    if (prev === undefined) return;

    if (top <= TOP_ZONE) {
      acc = 0;
      setMin(false);
      return;
    }
    const dy = top - prev;
    if (dy === 0) return; // horizontal scroll
    // Reset the accumulator on direction change.
    if ((dy > 0 && acc < 0) || (dy < 0 && acc > 0)) acc = 0;
    acc += dy;
    if (acc > DOWN_DISTANCE) {
      setMin(true);
      acc = 0;
    } else if (acc < -UP_DISTANCE) {
      setMin(false);
      acc = 0;
    }
  };

  d.listen(
    document,
    'scroll',
    (e) => {
      const t = e.target;
      const el =
        t === document ? document.scrollingElement : t instanceof Element ? t : null;
      if (!el) return;
      if (el.scrollHeight - el.clientHeight < MIN_SCROLL_RANGE) return;
      if (el !== document.scrollingElement && el.closest(SEL.scrollIgnore)) return;
      pending = el;
      if (!frame) frame = requestAnimationFrame(evaluate);
    },
    { capture: true, passive: true },
  );

  // Tapping the collapsed bar expands it (the tap still reaches the button).
  d.listen(
    document,
    'pointerdown',
    (e) => {
      if (e.target instanceof Element && e.target.closest(SEL.tabBar)) setMin(false);
    },
    { capture: true, passive: true },
  );

  d.add(() => {
    if (frame) cancelAnimationFrame(frame);
    body.classList.remove(MIN_CLASS);
  });

  return { expand: () => setMin(false) };
};
