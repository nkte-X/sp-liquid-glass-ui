// Types shared by plugin.js (host) and the settings UI (iframe).
// TYPES ONLY: a runtime export here would make Rollup emit a shared chunk
// and plugin.js would no longer be a plain script (see check-plugin-js.js).

export type GlassVariant = 'clear' | 'regular' | 'tinted';

/** Background behind the glass. 'theme' keeps the theme's own wallpaper;
 *  `custom:<id>` selects one of the user's own designs. */
export type PresetWallpaper = 'theme' | 'aurora' | 'ocean' | 'sunset' | 'graphite';
export type WallpaperVariant = PresetWallpaper | `custom:${string}`;

/** Top scroll edge effect (SwiftUI scrollEdgeEffectStyle). */
export type ScrollEdgeVariant = 'off' | 'soft' | 'hard';

export type PatternKind = 'none' | 'dots' | 'grid' | 'lines';

export interface WallpaperBlob {
  /** #rrggbb */
  color: string;
  /** centre, % of the viewport */
  x: number;
  y: number;
  /** radius, % of the viewport */
  size: number;
  /** 0–1 */
  opacity: number;
}

/** A user-designed wallpaper: base gradient per mode + colour blobs + an
 *  optional repeating pattern. Every field is validated before it reaches
 *  CSS (hex colours, clamped numbers). */
export interface CustomWallpaper {
  id: string;
  name: string;
  angle: number;
  /** base gradient stops, light mode */
  light: [string, string];
  /** base gradient stops, dark mode */
  dark: [string, string];
  blobs: WallpaperBlob[];
  pattern: PatternKind;
  /** 0–0.3 */
  patternOpacity: number;
  /** px, 6–64 */
  patternSize: number;
}

export interface LgxSettings {
  /** Inject the bundled iOS Liquid Glass theme (no separate theme install). */
  bundledTheme: boolean;
  /** Wallpaper behind glass surfaces. */
  wallpaper: WallpaperVariant;
  /** User wallpaper designs (max 8). */
  customWallpapers: CustomWallpaper[];
  /** Accent / primary colour override, #rrggbb (light-mode value); '' = the
   *  app's own. System colours resolve to their light/dark pair. */
  accent: string;
  /** Dark-mode variant of a custom accent, #rrggbb; '' = derived (lighter in
   *  OKLCH). Ignored for system colours. A separate key, not an object in
   *  `accent`, so older plugin builds on other synced devices keep reading
   *  a valid accent. */
  accentDark: string;
  /** Collapse the tab bar to the selected tab while scrolling down. */
  tabBarMinimize: boolean;
  /** Light glow under the finger on glass controls. */
  pressGlow: boolean;
  /** Haptic tick on tab / add / done taps (Android bridge, iOS experimental). */
  haptics: boolean;
  /** Scale the app's font tokens with iOS Dynamic Type. */
  dynamicType: boolean;
  /** Glass fill strength of the chrome (tab bar, header groups). */
  glass: GlassVariant;
  /** Blur/fade what scrolls under the top edge of the sidebar and content. */
  scrollEdge: ScrollEdgeVariant;
}

export interface ComposeSnapshot {
  at: string;
  host: string | null;
  /** Container radius equals the theme's --lgx-compose-radius. */
  themeApplied: boolean;
  container: Record<string, string> | null;
  input: Record<string, string> | null;
  ancestors: string[];
  skeleton: string;
}

export interface LgxDiagnostics {
  pluginVersion: string;
  /** --lgx-theme-version in effect ('' = pre-0.3.0 build). */
  themeVersion: string;
  /** Version of the theme bundled into this plugin build. */
  bundledThemeVersion: string;
  /** Where the active theme comes from. */
  themeSource: 'bundled' | 'installed' | 'both' | 'none';
  /** Last add-task window seen (captured when its input gets focus). */
  compose: ComposeSnapshot | null;
  userAgent: string;
  bodyClasses: string[];
  /** The ios-liquid-glass theme is active (its tokens resolve). */
  isThemeActive: boolean;
  /** Feature support on this device. */
  support: {
    tabBar: boolean;
    hapticsAndroid: boolean;
    hapticsIosSwitch: boolean;
    dynamicType: boolean;
    reducedTransparency: boolean;
    reducedMotion: boolean;
    increasedContrast: boolean;
  };
  /** Dynamic Type body size in px (17 = default), when measurable. */
  dynamicTypeBodyPx: number | null;
  /** Selector → found in the current DOM. */
  selectors: Record<string, boolean>;
  safeArea: Record<string, string>;
}

export interface LgxState {
  settings: LgxSettings;
  diagnostics: LgxDiagnostics;
  /** Resolved accent variants (null = app colour), for the picker preview. */
  accentVariants: { light: string; dark: string; lightHc: string; darkHc: string } | null;
  /** Rendered CSS of each custom wallpaper, for swatches. */
  wallpaperPreviews: Record<string, { light: string; dark: string }>;
}

export interface RenderedWallpaper {
  light: string;
  dark: string;
}

export type LgxMessage =
  | { type: 'getState' }
  | { type: 'setSettings'; payload: Partial<LgxSettings> }
  | { type: 'resetSettings' }
  /** Render a wallpaper design to CSS backgrounds (for live previews). */
  | { type: 'renderWallpaper'; payload: CustomWallpaper };
