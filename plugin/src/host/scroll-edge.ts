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
  const marked = new Set<Element>();
  const pending = new Set<Element>();
  let frame = 0;

  const mark = (el: Element, cls: string, on: boolean): void => {
    el.classList.toggle(cls, on);
    if (on) marked.add(el);
  };

  const flush = (): void => {
    frame = 0;
    for (const el of pending) {
      const on = el.scrollTop > 1;
      if (el.matches(SIDENAV)) {
        mark(el, EDGE, on);
        const list = el.querySelector<HTMLElement>('.nav-list');
        if (list) {
          const vt = el.getBoundingClientRect().top - list.getBoundingClientRect().top;
          list.style.setProperty('--lgx-vt', `${Math.max(0, Math.round(vt))}px`);
          if (on) marked.add(list);
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
    if (!document.body.classList.contains('hasMobileBottomNav')) return;
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

  // Plugin views scroll inside their iframe document.
  const hooked = new WeakSet<HTMLIFrameElement>();
  const hookIframe = (f: HTMLIFrameElement): void => {
    if (hooked.has(f)) return;
    let win: Window | null = null;
    try {
      win = f.contentWindow;
      void win?.document; // throws if cross-origin
    } catch {
      return;
    }
    if (!win) return;
    hooked.add(f);
    const onScroll = (): void => {
      let y = 0;
      try {
        y = win!.scrollY || win!.document.scrollingElement?.scrollTop || 0;
      } catch {
        return;
      }
      mark(f, FADE, y > 1);
    };
    win.addEventListener('scroll', onScroll, { passive: true, capture: true });
    d.add(() => {
      try {
        win!.removeEventListener('scroll', onScroll, { capture: true });
      } catch {
        // iframe gone
      }
    });
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
        hooked.delete(e.target); // new document inside: re-hook
        hookIframe(e.target);
      }
    },
    { capture: true },
  );
  // plugin views mount on navigation
  d.listen(
    document,
    'click',
    () =>
      setTimeout(() => {
        hookAll();
        probe();
      }, 400),
    { passive: true },
  );

  d.add(() => {
    if (frame) cancelAnimationFrame(frame);
    for (const el of marked) {
      el.classList.remove(FADE, FADE_BOTTOM, EDGE);
      (el as HTMLElement).style?.removeProperty('--lgx-vt');
    }
    for (const el of document.querySelectorAll(`.${FADE}, .${FADE_BOTTOM}, .${EDGE}`)) {
      el.classList.remove(FADE, FADE_BOTTOM, EDGE);
    }
  });
};
