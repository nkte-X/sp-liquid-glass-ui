// Other plugins' iframe UIs get the host's theme tokens copied in
// (plugin-iframe.util.ts in the app). The glass theme makes --card-bg and
// --bg translucent, which is right for the host (there is a wallpaper and a
// blur behind) but wrong inside an iframe: a plugin's native <dialog> — the
// UI kit paints it with var(--card-bg) — lets the page under it read
// through. Plugin iframes are same-origin, so add a small override after the
// injected tokens: opaque card surface, and a proper glass dialog.

import type { Disposer } from './disposer';
import { A11Y_QUERIES, prefersReducedTransparency, watchMedia } from './env';

const STYLE_ID = 'lgx-iframe-surface';
const HOST_TOKENS_ID = 'injected-theme-vars'; // marks a plugin iframe

const css = (): string => {
  const cs = getComputedStyle(document.body);
  const dark = document.body.classList.contains('isDarkTheme');
  const solid = cs.getPropertyValue('--lgx-surface-solid').trim() || (dark ? '#1f2026' : '#f7f8fb');
  // Reduce Transparency: an opaque dialog, no blur anywhere.
  const reduce = prefersReducedTransparency();
  const dialogBg = reduce
    ? dark
      ? '#2c2c2e'
      : '#ffffff'
    : cs.getPropertyValue('--lgx-dialog-bg').trim() ||
      (dark ? 'rgba(36, 37, 44, 0.9)' : 'rgba(255, 255, 255, 0.9)');
  const blur = reduce ? 'none' : 'blur(40px) saturate(180%)';
  const radius = cs.getPropertyValue('--lgx-r-dialog-now').trim() || '26px';
  // The scrim only dims (iOS): a blurred scrim under a blurred dialog would
  // be two blur layers stacked.
  return `
:root { --card-bg: ${solid}; }
dialog {
  background: ${dialogBg} !important;
  -webkit-backdrop-filter: ${blur};
  backdrop-filter: ${blur};
  border-radius: ${radius} !important;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, ${dark ? 0.5 : 0.08}),
    0 24px 60px rgba(0, 0, 0, ${dark ? 0.55 : 0.22}) !important;
}
dialog::backdrop {
  background: rgba(0, 0, 0, ${dark ? 0.45 : 0.22});
}`;
};

const patch = (iframe: HTMLIFrameElement, text: string): void => {
  let doc: Document | null = null;
  try {
    doc = iframe.contentDocument;
  } catch {
    return; // cross-origin: not a plugin iframe
  }
  if (!doc?.head || !doc.getElementById(HOST_TOKENS_ID)) return;
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
  }
  style.textContent = text;
  doc.head.appendChild(style); // (re)append: stay after the host's tokens
};

const patchAll = (): void => {
  const text = css();
  for (const f of document.querySelectorAll('iframe')) patch(f, text);
};

export const startPluginIframes = (d: Disposer): void => {
  patchAll();
  // iframe `load` doesn't bubble, but a capture listener on the document sees it
  d.listen(
    document,
    'load',
    (e) => {
      if (e.target instanceof HTMLIFrameElement) patch(e.target, css());
    },
    { capture: true },
  );
  // light/dark switch → refresh the values
  const mo = new MutationObserver(patchAll);
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  d.add(() => mo.disconnect());
  watchMedia(d, A11Y_QUERIES, patchAll);
  d.add(() => {
    for (const f of document.querySelectorAll('iframe')) {
      try {
        f.contentDocument?.getElementById(STYLE_ID)?.remove();
      } catch {
        // ignore
      }
    }
  });
};
