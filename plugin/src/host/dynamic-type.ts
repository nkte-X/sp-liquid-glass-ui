// Dynamic Type (iOS): WebKit resolves `font: -apple-system-body` to the
// user's text size from Settings → Display & Brightness → Text Size
// (17px at the default size). The app's text is sized through
// --font-size-* tokens in px, so scale those by measured / 17.
//
// Re-measured when the app comes back to the foreground, since that is
// when a user who just changed the setting in iOS Settings returns.

import type { Disposer } from './disposer';
import { isIOS } from './env';

const BASE_BODY_PX = 17;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.6; // accessibility sizes go far beyond what the layout fits

/** The app's font tokens and their default px (src/styles/_css-variables.scss). */
const TOKENS: Record<string, number> = {
  '--font-size-xs': 11,
  '--font-size-sm': 12,
  '--font-size-md': 14,
  '--font-size-lg': 16,
  '--font-size-xl': 18,
  '--font-size-2xl': 22,
  '--font-size-3xl': 28,
};

export const measureDynamicTypeBodyPx = (): number | null => {
  const probe = document.createElement('span');
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body';
  probe.textContent = 'x';
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  // Outside WebKit the keyword is invalid and the probe inherits the body
  // size; only trust it on iOS.
  return isIOS() && Number.isFinite(px) && px > 0 ? px : null;
};

export const startDynamicType = (d: Disposer): void => {
  if (!isIOS()) return;
  const style = document.body.style;

  const apply = (): void => {
    const px = measureDynamicTypeBodyPx();
    if (px === null) return;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, px / BASE_BODY_PX));
    for (const [name, base] of Object.entries(TOKENS)) {
      style.setProperty(name, `${Math.round(base * scale * 10) / 10}px`);
    }
  };

  apply();
  d.listen(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') apply();
  });
  d.add(() => {
    for (const name of Object.keys(TOKENS)) style.removeProperty(name);
  });
};
