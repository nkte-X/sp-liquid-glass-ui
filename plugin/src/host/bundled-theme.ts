// The iOS Liquid Glass theme, bundled into plugin.js at build time
// (themes/ios-liquid-glass.css via Vite `?raw`), so installing the plugin
// alone is enough. Injected as its own <style>, removed on unload / when
// the setting is turned off.
//
// If the same theme is also installed through Settings → Theme, both copies
// apply; they are identical rules, so that is harmless — but selecting the
// "Default" theme in the picker avoids loading the CSS twice.

import THEME_CSS from '../../../themes/ios-liquid-glass.css?raw';
import type { Disposer } from './disposer';

export const THEME_STYLE_ID = 'lgx-bundled-theme';
const INSTALLED_THEME_ID = 'custom-theme-stylesheet';

export const BUNDLED_THEME_VERSION =
  /--lgx-theme-version:\s*'([^']+)'/.exec(THEME_CSS)?.[1] ?? '';

export const startBundledTheme = (d: Disposer): void => {
  document.getElementById(THEME_STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = THEME_STYLE_ID;
  style.textContent = THEME_CSS;
  // Before the plugin's own state CSS (if already present) so plugin rules
  // keep winning ties; otherwise at the end of <head>.
  const pluginStyle = document.getElementById('lgx-plugin-style');
  document.head.insertBefore(style, pluginStyle);
  d.add(() => style.remove());
};

/** Whether a theme installed through the app's picker carries our tokens. */
export const isInstalledThemeOurs = (): boolean => {
  const el = document.getElementById(INSTALLED_THEME_ID);
  if (!el) return false;
  if (el instanceof HTMLStyleElement) return (el.textContent ?? '').includes('--lgx-theme-version');
  // <link> to a built-in theme: never ours
  return false;
};
