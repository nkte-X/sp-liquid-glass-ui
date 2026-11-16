// Settings defaults + validation. Values from the synced store and from the
// settings UI both pass through sanitizeSettings: colours and numbers end up
// inside generated CSS, so anything that isn't a strict #rrggbb or a clamped
// number is dropped here (no way to smuggle `;}` or url() into a rule).

import type {
  CustomWallpaper,
  GlassVariant,
  LgxSettings,
  PatternKind,
  ScrollEdgeVariant,
  WallpaperBlob,
} from '../protocol';

export const DEFAULT_SETTINGS: LgxSettings = {
  bundledTheme: true,
  wallpaper: 'theme',
  customWallpapers: [],
  accent: '',
  accentDark: '',
  tabBarMinimize: true,
  pressGlow: true,
  haptics: true,
  dynamicType: false,
  glass: 'regular',
  scrollEdge: 'soft',
};

const ENUMS: { [K in keyof LgxSettings]?: readonly string[] } = {
  glass: ['clear', 'regular', 'tinted'] satisfies GlassVariant[],
  scrollEdge: ['off', 'soft', 'hard'] satisfies ScrollEdgeVariant[],
};

const PRESET_WALLPAPERS = ['theme', 'aurora', 'ocean', 'sunset', 'graphite'];
const PATTERNS: PatternKind[] = ['none', 'dots', 'grid', 'lines'];
const MAX_WALLPAPERS = 8;
const MAX_BLOBS = 5;

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const hex = (v: unknown, fallback: string): string => (isHex(v) ? v.toLowerCase() : fallback);

const sanitizeBlob = (raw: unknown): WallpaperBlob | null => {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (!isHex(b.color)) return null;
  return {
    color: b.color.toLowerCase(),
    x: num(b.x, -20, 120, 50),
    y: num(b.y, -20, 120, 50),
    size: num(b.size, 10, 120, 55),
    opacity: num(b.opacity, 0, 1, 0.5),
  };
};

export const sanitizeWallpaper = (raw: unknown): CustomWallpaper | null => {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Record<string, unknown>;
  const id = typeof w.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(w.id) ? w.id : null;
  if (!id) return null;
  const pair = (v: unknown, d: [string, string]): [string, string] =>
    Array.isArray(v) ? [hex(v[0], d[0]), hex(v[1], d[1])] : d;
  return {
    id,
    name: typeof w.name === 'string' ? w.name.slice(0, 40) : 'Wallpaper',
    angle: num(w.angle, 0, 360, 180),
    light: pair(w.light, ['#eef1ff', '#e6ecfb']),
    dark: pair(w.dark, ['#0b0c1a', '#05060d']),
    blobs: (Array.isArray(w.blobs) ? w.blobs : [])
      .map(sanitizeBlob)
      .filter((b): b is WallpaperBlob => !!b)
      .slice(0, MAX_BLOBS),
    pattern: PATTERNS.includes(w.pattern as PatternKind) ? (w.pattern as PatternKind) : 'none',
    patternOpacity: num(w.patternOpacity, 0, 0.3, 0.08),
    patternSize: num(w.patternSize, 6, 64, 18),
  };
};

/** Accept only known keys with the right types; anything else → default. */
export const sanitizeSettings = (raw: unknown): LgxSettings => {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof LgxSettings)[]) {
    const v = src[key];
    const allowed = ENUMS[key];
    if (allowed) {
      if (typeof v === 'string' && allowed.includes(v)) out[key] = v;
    } else if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
      if (typeof v === 'boolean') out[key] = v;
    }
  }

  const walls = (Array.isArray(src.customWallpapers) ? src.customWallpapers : [])
    .map(sanitizeWallpaper)
    .filter((w): w is CustomWallpaper => !!w)
    .slice(0, MAX_WALLPAPERS);
  out.customWallpapers = walls;

  const wp = src.wallpaper;
  if (typeof wp === 'string') {
    if (PRESET_WALLPAPERS.includes(wp)) out.wallpaper = wp;
    else if (wp.startsWith('custom:') && walls.some((w) => `custom:${w.id}` === wp)) {
      out.wallpaper = wp;
    }
  }

  out.accent = src.accent === '' || isHex(src.accent) ? String(src.accent).toLowerCase() : '';
  out.accentDark = isHex(src.accentDark) && out.accent ? src.accentDark.toLowerCase() : '';

  return out as unknown as LgxSettings;
};

export const parseSettings = (json: string | null | undefined): LgxSettings => {
  if (!json) return { ...DEFAULT_SETTINGS };
  try {
    return sanitizeSettings(JSON.parse(json));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const sameSettings = (a: LgxSettings, b: LgxSettings): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
