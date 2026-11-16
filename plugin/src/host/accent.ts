// Accent colour override. The app writes its palette (per project / tag
// colour) as inline custom properties on <html>; declaring the same names
// inline on <body> wins for everything below it, so --c-primary, --brand,
// buttons, chips, the play button and the theme's --lgx-tint all follow.
// The app's second palette (`accent`, yellow by default) is overridden with
// the same colour: while time is tracked the play button and the tracked
// task pill switch to --c-accent, and one accent means one colour there too.
// Shades are derived like a Material palette: tints toward white above 500,
// shades toward black below.
//
// Apple's colours come in variants (HIG Color): light, dark, and an
// increased-contrast version of each. System colours use Apple's own
// values; a custom colour gets a lighter dark-mode variant derived in OKLCH
// (or the user's own) and high-contrast variants pushed to 4.5:1 against the
// grouped cell colour. The active variant follows body.isDarkTheme and
// `prefers-contrast: more` live.

import type { Disposer } from './disposer';
import { prefersIncreasedContrast, watchMedia } from './env';

type Rgb = [number, number, number];

export interface AccentVariants {
  light: string;
  dark: string;
  lightHc: string;
  darkHc: string;
}

/** iOS system colours: [light, dark, light HC, dark HC]. Keys are the light
 *  values the settings UI stores. */
const SYSTEM: Record<string, [string, string, string, string]> = {
  '#007aff': ['#007aff', '#0a84ff', '#0040dd', '#409cff'], // blue
  '#5856d6': ['#5856d6', '#5e5ce6', '#3634a3', '#7d7aff'], // indigo
  '#af52de': ['#af52de', '#bf5af2', '#8944ab', '#da8fff'], // purple
  '#ff2d55': ['#ff2d55', '#ff375f', '#d30f45', '#ff6482'], // pink
  '#ff3b30': ['#ff3b30', '#ff453a', '#d70015', '#ff6961'], // red
  '#ff9500': ['#ff9500', '#ff9f0a', '#c93400', '#ffb340'], // orange
  '#ffcc00': ['#ffcc00', '#ffd60a', '#b25000', '#ffd426'], // yellow
  '#34c759': ['#34c759', '#30d158', '#248a3d', '#30db5b'], // green
  '#30b0c7': ['#30b0c7', '#40c8e0', '#0071a4', '#5de6ff'], // teal
  '#8e8e93': ['#8e8e93', '#8e8e93', '#6c6c70', '#aeaeb2'], // graphite
};

const SHADES: [string, number][] = [
  ['50', 0.88],
  ['100', 0.74],
  ['200', 0.56],
  ['300', 0.36],
  ['400', 0.18],
  ['500', 0],
  ['600', -0.08],
  ['700', -0.16],
  ['800', -0.24],
  ['900', -0.36],
  ['A100', 0.8],
  ['A200', 0.55],
  ['A400', 0.25],
  ['A700', 0.1],
];

const toRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (c: Rgb): string =>
  '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

const mix = (c: Rgb, t: number): Rgb => {
  const target = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  return c.map((v) => Math.round(v + (target - v) * k)) as Rgb;
};

const lin = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const unlin = (v: number): number =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);

const luminance = ([r, g, b]: Rgb): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

const contrast = (a: Rgb, b: Rgb): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// sRGB ⇄ OKLab (Björn Ottosson's matrices)
const toOklab = ([r, g, b]: Rgb): Rgb => {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const fromOklab = ([L, a, b]: Rgb): Rgb => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    unlin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    unlin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    unlin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

/** Shift OKLCH lightness by `dl` (−1…1), hue and chroma kept. */
const shiftL = (hex: string, dl: number): string => {
  const [L, a, b] = toOklab(toRgb(hex));
  return toHex(fromOklab([Math.min(1, Math.max(0, L + dl)), a, b]));
};

/** Darken (light mode) / lighten (dark mode) until 4.5:1 against `bg`. */
const toContrast = (hex: string, bg: string, dir: -1 | 1): string => {
  let c = hex;
  for (let i = 0; i < 40 && contrast(toRgb(c), toRgb(bg)) < 4.5; i++) c = shiftL(c, dir * 0.02);
  return c;
};

/** The dark-mode variant for a custom colour: ~7% lighter in OKLCH. */
export const deriveDark = (hex: string): string => shiftL(hex, 0.07);

export const accentVariants = (light: string, darkOverride = ''): AccentVariants => {
  const sys = SYSTEM[light.toLowerCase()];
  if (sys) return { light: sys[0], dark: sys[1], lightHc: sys[2], darkHc: sys[3] };
  const dark = darkOverride || deriveDark(light);
  return {
    light,
    dark,
    lightHc: toContrast(light, '#ffffff', -1),
    darkHc: toContrast(dark, '#1c1c1e', 1),
  };
};

const props = (hex: string, prefix: string): Record<string, string> => {
  const base = toRgb(hex);
  const out: Record<string, string> = {};
  for (const [name, t] of SHADES) {
    const c = mix(base, t);
    out[`--palette-${prefix}-${name}`] = `rgb(${c.join(', ')})`;
    out[`--palette-${prefix}-${name}-no-rgb`] = c.join(', ');
    // the app's convention: dark text on light shades, light text on dark ones
    const text = luminance(c) > 0.42 ? 'dark' : 'light';
    out[`--palette-${prefix}-contrast-${name}`] = `var(--${text}-text-contrast)`;
    out[`--palette-${prefix}-contrast-${name}-no-rgb`] = `var(--${text}-text-contrast-no-rgb)`;
  }
  return out;
};

export const startAccent = (d: Disposer, light: string, darkOverride: string): void => {
  const style = document.body.style;
  const v = accentVariants(light, darkOverride);
  let current = '';
  const PALETTES = ['primary', 'accent'];
  // --c-primary / --c-accent are declared on :root from the palette, so they
  // resolve there and would keep the app's colour; re-declare them here.
  const ALIASES: Record<string, string> = {
    '--c-primary': 'var(--palette-primary-500)',
    '--c-accent': 'var(--palette-accent-500)',
  };
  const keys = [
    ...PALETTES.flatMap((p) => Object.keys(props('#000000', p))),
    ...Object.keys(ALIASES),
  ];
  for (const [k, v] of Object.entries(ALIASES)) style.setProperty(k, v);

  const write = (): void => {
    const dark = document.body.classList.contains('isDarkTheme');
    const hc = prefersIncreasedContrast();
    const hex = dark ? (hc ? v.darkHc : v.dark) : hc ? v.lightHc : v.light;
    if (hex === current) return;
    current = hex;
    for (const p of PALETTES) {
      for (const [k, val] of Object.entries(props(hex, p))) style.setProperty(k, val);
    }
  };

  write();
  const mo = new MutationObserver(write);
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  d.add(() => mo.disconnect());
  watchMedia(d, ['(prefers-contrast: more)'], write);
  d.add(() => {
    for (const k of keys) style.removeProperty(k);
  });
};
