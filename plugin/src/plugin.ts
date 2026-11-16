// Liquid Glass UI — host side (runs in the app renderer via `new Function`).
//
// Adds the behaviour the iOS Liquid Glass theme can't express in CSS. Each
// feature is a FeatureSlot that can be switched on/off live from the
// settings view; onUnload tears everything down so disabling the plugin
// leaves the app exactly as the theme alone renders it.
//
// Must stay a plain script: import runtime code only from ./host/**, and
// only `import type` from ./protocol (see scripts/check-plugin-js.js).

import type { PluginAPI } from '@super-productivity/plugin-api';
import type { LgxMessage, LgxSettings, LgxState } from './protocol';
import { accentVariants, startAccent } from './host/accent';
import { startBundledTheme } from './host/bundled-theme';
import { startComposeProbe } from './host/compose-probe';
import { collectDiagnostics } from './host/diagnostics';
import { Disposer, FeatureSlot } from './host/disposer';
import { A11Y_QUERIES, prefersReducedTransparency, watchMedia } from './host/env';
import { startSheetState } from './host/sheet';
import { startDynamicType } from './host/dynamic-type';
import { startHaptics } from './host/haptics';
import { startPluginIframes } from './host/plugin-iframes';
import { startPressGlow } from './host/press-glow';
import { startScrollEdge } from './host/scroll-edge';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  sameSettings,
  sanitizeSettings,
  sanitizeWallpaper,
} from './host/settings';
import { PLUGIN_CSS, STYLE_ID } from './host/style';
import { startTabBarMinimize, type TabBarControl } from './host/tab-bar';
import { renderWallpaper, startCustomWallpaper } from './host/wallpaper-css';

declare const plugin: PluginAPI;
declare const __LGX_VERSION__: string;

const body = document.body;
const root = new Disposer();
const slots = {
  theme: new FeatureSlot(),
  accent: new FeatureSlot(),
  wallpaper: new FeatureSlot(),
  iframes: new FeatureSlot(),
  scrollEdge: new FeatureSlot(),
  sheet: new FeatureSlot(),
  tabBar: new FeatureSlot(),
  glow: new FeatureSlot(),
  haptics: new FeatureSlot(),
  dynamicType: new FeatureSlot(),
};

let settings: LgxSettings = { ...DEFAULT_SETTINGS };
let tabBar: TabBarControl | null = null;
let themeStarted = false;

const log = (msg: string, err?: unknown): void => {
  try {
    if (err) plugin.log.err(`[liquid-glass-ui] ${msg}`, err);
    else plugin.log.info(`[liquid-glass-ui] ${msg}`);
  } catch {
    // logging must never break startup
  }
};

// ---------------------------------------------------------------------------
// Body classes: lgx-on + one per active presentational feature.

const desiredClasses = (): string[] => {
  const cls = ['lgx-on'];
  const reduceTransparency = prefersReducedTransparency();
  if (settings.glass !== 'regular' && !reduceTransparency) {
    cls.push(`lgx-glass-${settings.glass}`);
  }
  if (settings.scrollEdge !== 'off') cls.push(`lgx-edge-${settings.scrollEdge}`);
  if (activeCustomWallpaper()) cls.push('lgx-wp-custom');
  else if (settings.wallpaper !== 'theme') cls.push(`lgx-wp-${settings.wallpaper}`);
  if (settings.pressGlow) cls.push('lgx-glow');
  return cls;
};

const ALL_CLASSES = [
  'lgx-on',
  'lgx-glass-clear',
  'lgx-glass-tinted',
  'lgx-wp-aurora',
  'lgx-wp-ocean',
  'lgx-wp-sunset',
  'lgx-wp-graphite',
  'lgx-wp-custom',
  'lgx-edge-soft',
  'lgx-edge-hard',
  'lgx-glow',
];

const activeCustomWallpaper = () =>
  settings.wallpaper.startsWith('custom:')
    ? settings.customWallpapers.find((w) => `custom:${w.id}` === settings.wallpaper) ?? null
    : null;

const syncClasses = (): void => {
  const want = desiredClasses();
  for (const c of ALL_CLASSES) body.classList.toggle(c, want.includes(c));
};

// ---------------------------------------------------------------------------

const injectStyle = (): void => {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PLUGIN_CSS;
  document.head.appendChild(style);
  root.add(() => style.remove());
};

/** The app manages body classes itself; put ours back if it rewrites them. */
const guardClasses = (): void => {
  const mo = new MutationObserver(() => {
    if (desiredClasses().some((c) => !body.classList.contains(c))) syncClasses();
  });
  mo.observe(body, { attributes: true, attributeFilter: ['class'] });
  root.add(() => mo.disconnect());
};

const runSlot = (name: keyof typeof slots, on: boolean, start: (d: Disposer) => void): void => {
  try {
    slots[name].set(on, start);
  } catch (e) {
    log(`feature "${name}" failed to start; leaving it off`, e);
  }
};

const apply = (next: LgxSettings): void => {
  // Theme first: diagnostics and the features read its tokens. Only
  // restarted when the setting actually flips — re-inserting 70 KB of CSS
  // on every settings change would restyle the whole app needlessly.
  const themeChanged = next.bundledTheme !== settings.bundledTheme || !themeStarted;
  settings = next;
  if (themeChanged) {
    themeStarted = true;
    runSlot('theme', next.bundledTheme, startBundledTheme);
  }
  syncClasses();
  runSlot('accent', !!next.accent, (d) => startAccent(d, next.accent, next.accentDark));
  const custom = activeCustomWallpaper();
  runSlot('wallpaper', !!custom, (d) => startCustomWallpaper(d, custom!));
  runSlot('iframes', true, startPluginIframes);
  runSlot('scrollEdge', next.scrollEdge !== 'off', startScrollEdge);
  runSlot('sheet', true, startSheetState);
  runSlot('tabBar', next.tabBarMinimize, (d) => {
    tabBar = startTabBarMinimize(d);
    d.add(() => (tabBar = null));
  });
  runSlot('glow', next.pressGlow, startPressGlow);
  runSlot('haptics', next.haptics, startHaptics);
  runSlot('dynamicType', next.dynamicType, startDynamicType);
};

// ---------------------------------------------------------------------------
// Persistence (synced across devices; features self-gate per platform).

const load = async (): Promise<LgxSettings> => parseSettings(await plugin.loadSyncedData());

const save = (s: LgxSettings): Promise<void> => plugin.persistDataSynced(JSON.stringify(s));

const state = (): LgxState => ({
  settings,
  diagnostics: collectDiagnostics(__LGX_VERSION__),
  accentVariants: settings.accent ? accentVariants(settings.accent, settings.accentDark) : null,
  wallpaperPreviews: Object.fromEntries(
    settings.customWallpapers.map((w) => [w.id, renderWallpaper(w)]),
  ),
});

// ---------------------------------------------------------------------------

/** Leftovers of older plugin builds that were replaced without a clean
 *  unload (seen in the wild: 0.5.0 still carrying 0.4.0's lgx-refract). */
const removeLegacy = (): void => {
  for (const c of [...body.classList]) {
    if (c.startsWith('lgx-') && !ALL_CLASSES.includes(c) && c !== 'lgx-tabbar-min') {
      body.classList.remove(c);
    }
  }
  document.getElementById('lgx-svg')?.remove();
};

const init = async (): Promise<void> => {
  removeLegacy();
  injectStyle();
  guardClasses();
  // Reduce Transparency etc. can flip while the app is open: re-derive the
  // classes that depend on them (glass presets, task cards).
  watchMedia(root, A11Y_QUERIES, syncClasses);
  startComposeProbe(root);
  apply(await load());

  plugin.registerHook(plugin.Hooks.PERSISTED_DATA_CHANGED, async () => {
    const next = await load();
    if (!sameSettings(next, settings)) apply(next);
  });

  plugin.registerHook(plugin.Hooks.WORK_CONTEXT_CHANGE, () => tabBar?.expand());

  log(`started (${__LGX_VERSION__})`);
};

plugin.onMessage?.(async (raw: unknown) => {
  const msg = raw as LgxMessage;
  switch (msg?.type) {
    case 'getState':
      return state();
    case 'setSettings': {
      const patch = { ...msg.payload };
      // a new accent starts with the derived dark variant again
      if ('accent' in patch && patch.accent !== settings.accent && !('accentDark' in patch)) {
        patch.accentDark = '';
      }
      const next = sanitizeSettings({ ...settings, ...patch });
      apply(next);
      await save(next);
      return state();
    }
    case 'renderWallpaper': {
      const w = sanitizeWallpaper(msg.payload);
      return w ? renderWallpaper(w) : { error: 'invalid wallpaper' };
    }
    case 'resetSettings': {
      const next = { ...DEFAULT_SETTINGS };
      apply(next);
      await save(next);
      return state();
    }
    default:
      return { error: 'unknown message' };
  }
});

plugin.onUnload?.(() => {
  for (const slot of Object.values(slots)) slot.stop();
  root.run();
  for (const c of ALL_CLASSES) body.classList.remove(c);
});

const start = (): void => {
  init().catch((e) => log('startup failed', e));
};
if (plugin.onReady) plugin.onReady(start);
else start();
