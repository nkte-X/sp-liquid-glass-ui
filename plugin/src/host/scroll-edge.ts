// Scroll edge effect — the web take on SwiftUI's
// `.scrollEdgeEffectStyle(.soft, for: .top)`: once content is scrolled, what
// slides under the top edge fades out instead of being cut off hard under the
// header / traffic lights.
//
// v0.6.0 drew blurred overlay layers with a mask. On macOS Electron (GPU
// compositing) the mask was not applied to the backdrop blur, leaving a solid
// band with a hard edge, and pages rendered in plugin iframes never reported
// their scrolling at all. Now:
//   - page scrollers get `lgx-edge-fade` → a mask on the scroller itself
//     (masks on ordinary content work everywhere);
//   - plugin iframes: their window's scroll is watched (same-origin) and the
//     <iframe> element gets `lgx-edge-fade`;
//   - sidebar: the panel is the scroller and its own glass background must
//     not fade, so the mask goes on the row list (.nav-list) instead. That
//     box scrolls with the content, so the visible top offset is published
//     as --lgx-vt and the gradient stops follow it. Rows dissolve into the
//     real panel/wallpaper colour — no guessed tint.
//   - bottom (with the floating tab bar only): `lgx-edge-fade-bottom` while
//     there is more content below, so content fades out under the capsule.
// Visuals live in style.ts.

import type { Disposer } from './disposer';

const FADE = 'lgx-edge-fade';
const FADE_BOTTOM = 'lgx-edge-fade-bottom';
const EDGE = 'lgx-edge';
const SIDENAV = 'magic-side-nav .nav-sidenav';
/** Scrollers that are chrome, not content. */
const IGNORE = '.cdk-overlay-container, .mobile-bottom-nav, main-header, add-task-bar, .action-bar, textarea';

export const startScrollEdge = (d: Disposer): void => {
  // No element registry: scrollers live inside routed pages and plugin views
  // live in iframes, both of which the app removes on navigation. Holding them
  // here would keep every detached page tree / iframe window alive for the
  // whole session. Cleanup finds what is still marked via the DOM instead.
  const pending = new Set<Element>();
  let frame = 0;
  let alive = true;

  const mark = (el: Element, cls: string, on: boolean): void => {
    el.classList.toggle(cls, on);
  };

  const flush = (): void => {
    frame = 0;
    if (!alive) return;
    for (const el of pending) {
      if (!el.isConnected) continue;
      const on = el.scrollTop > 1;
      if (el.matches(SIDENAV)) {
        mark(el, EDGE, on);
        const list = el.querySelector<HTMLElement>('.nav-list');
        if (list) {
          const vt = el.getBoundingClientRect().top - list.getBoundingClientRect().top;
          list.style.setProperty('--lgx-vt', `${Math.max(0, Math.round(vt))}px`);
        }
      }
      else if (el.closest('.route-wrapper, right-panel')) {
        mark(el, FADE, on);
        const more =
          document.body.classList.contains('hasMobileBottomNav') &&
          el.scrollTop + el.clientHeight < el.scrollHeight - 1;
        mark(el, FADE_BOTTOM, more);
      }
    }
    pending.clear();
  };

  /** Long lists show more content below before any scroll happens. */
  const probe = (): void => {
    if (!alive || !document.body.classList.contains('hasMobileBottomNav')) return;
    for (const el of document.querySelectorAll('.route-wrapper *, right-panel *')) {
      if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) {
        const oy = getComputedStyle(el).overflowY;
        if (oy === 'auto' || oy === 'scroll') pending.add(el);
      }
    }
    if (pending.size && !frame) frame = requestAnimationFrame(flush);
  };
  const probeTimer = setTimeout(probe, 300);
  d.add(() => clearTimeout(probeTimer));
  d.listen(window, 'resize', probe, { passive: true });

  d.listen(
    document,
    'scroll',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest(IGNORE)) return;
      pending.add(t);
      if (!frame) frame = requestAnimationFrame(flush);
    },
    { capture: true, passive: true },
  );

  // Plugin views scroll inside their iframe document. The listener lives on
  // the iframe's window; the WeakMap only lets cleanup find it again, and lets
  // a closed iframe be collected together with its window.
  type Hook = { win: Window; onScroll: () => void };
  const hooks = new WeakMap<HTMLIFrameElement, Hook>();
  const unhook = (f: HTMLIFrameElement): void => {
    const h = hooks.get(f);
    if (!h) return;
    hooks.delete(f);
    try {
      h.win.removeEventListener('scroll', h.onScroll, { capture: true });
    } catch {
      // iframe gone
    }
  };
  const hookIframe = (f: HTMLIFrameElement): void => {
    if (!alive) return;
    let win: Window | null = null;
    try {
      win = f.contentWindow;
      void win?.document; // throws if cross-origin
    } catch {
      return;
    }
    if (!win || hooks.get(f)?.win === win) return;
    unhook(f);
    const w = win;
    const onScroll = (): void => {
      let y = 0;
      try {
        y = w.scrollY || w.document.scrollingElement?.scrollTop || 0;
      } catch {
        return;
      }
      mark(f, FADE, y > 1);
    };
    w.addEventListener('scroll', onScroll, { passive: true, capture: true });
    hooks.set(f, { win: w, onScroll });
  };
  const hookAll = (): void => {
    for (const f of document.querySelectorAll('iframe')) hookIframe(f);
  };
  hookAll();
  d.listen(
    document,
    'load',
    (e) => {
      if (e.target instanceof HTMLIFrameElement) {
        unhook(e.target); // new document inside: re-hook
        hookIframe(e.target);
      }
    },
    { capture: true },
  );
  // plugin views mount on navigation
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  d.listen(
    document,
    'click',
    () => {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        hookAll();
        probe();
      }, 400);
    },
    { passive: true },
  );

  d.add(() => {
    alive = false;
    clearTimeout(clickTimer);
    if (frame) cancelAnimationFrame(frame);
    pending.clear();
    for (const f of document.querySelectorAll('iframe')) unhook(f);
    for (const el of document.querySelectorAll(`.${FADE}, .${FADE_BOTTOM}, .${EDGE}`)) {
      el.classList.remove(FADE, FADE_BOTTOM, EDGE);
    }
    for (const el of document.querySelectorAll<HTMLElement>(`${SIDENAV} .nav-list`)) {
      el.style.removeProperty('--lgx-vt');
    }
  });
};
