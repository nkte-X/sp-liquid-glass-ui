// Renders a CustomWallpaper to CSS background layers and applies the active
// one as `--lg-wallpaper` (the theme paints `body { background:
// var(--lg-wallpaper) fixed }`). Inputs are already sanitized (settings.ts),
// so only hex colours and clamped numbers reach the CSS.

import type { CustomWallpaper, RenderedWallpaper } from '../protocol';
import type { Disposer } from './disposer';

const STYLE_ID = 'lgx-custom-wallpaper';

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(a * 1000) / 1000})`;
};

const patternLayers = (w: CustomWallpaper, dark: boolean): string[] => {
  if (w.pattern === 'none' || w.patternOpacity <= 0) return [];
  const ink = dark ? `rgba(255, 255, 255, ${w.patternOpacity})` : `rgba(0, 0, 0, ${w.patternOpacity})`;
  const s = `${w.patternSize}px`;
  switch (w.pattern) {
    case 'dots':
      return [`radial-gradient(circle, ${ink} 1px, transparent 1.6px) 0 0 / ${s} ${s}`];
    case 'grid':
      return [
        `linear-gradient(${ink} 1px, transparent 1px) 0 0 / ${s} ${s}`,
        `linear-gradient(90deg, ${ink} 1px, transparent 1px) 0 0 / ${s} ${s}`,
      ];
    case 'lines':
      return [`repeating-linear-gradient(45deg, ${ink} 0 1px, transparent 1px ${s})`];
  }
};

const render = (w: CustomWallpaper, dark: boolean): string => {
  const [a, b] = dark ? w.dark : w.light;
  const blobAlpha = dark ? 1.1 : 1; // blobs need a touch more presence on dark bases
  const blobs = w.blobs.map(
    (bl) =>
      `radial-gradient(${bl.size}% ${Math.round(bl.size * 0.8)}% at ${bl.x}% ${bl.y}%, ${rgba(
        bl.color,
        Math.min(1, bl.opacity * blobAlpha),
      )}, transparent 70%)`,
  );
  return [...patternLayers(w, dark), ...blobs, `linear-gradient(${w.angle}deg, ${a}, ${b})`].join(
    ', ',
  );
};

export const renderWallpaper = (w: CustomWallpaper): RenderedWallpaper => ({
  light: render(w, false),
  dark: render(w, true),
});

/** Inject the active custom wallpaper; body.lgx-wp-custom switches it on. */
export const startCustomWallpaper = (d: Disposer, w: CustomWallpaper): void => {
  document.getElementById(STYLE_ID)?.remove();
  const { light, dark } = renderWallpaper(w);
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    `html body.lgx-on.lgx-wp-custom { --lg-wallpaper: ${light}; }\n` +
    `html body.lgx-on.isDarkTheme.lgx-wp-custom { --lg-wallpaper: ${dark}; }`;
  document.head.appendChild(style);
  d.add(() => style.remove());
};
