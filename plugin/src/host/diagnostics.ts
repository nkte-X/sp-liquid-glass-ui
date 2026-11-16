// Snapshot of what this device actually offers. Shown in the settings view —
// it is the on-device check from docs/design-spec.md §6, without needing
// Safari Web Inspector.

import type { LgxDiagnostics } from '../protocol';
import { BUNDLED_THEME_VERSION, THEME_STYLE_ID, isInstalledThemeOurs } from './bundled-theme';
import { lastComposeSnapshot } from './compose-probe';
import { measureDynamicTypeBodyPx } from './dynamic-type';
import {
  SEL,
  hasTabBar,
  isAndroidApp,
  isIOS,
  isThemeActive,
  prefersIncreasedContrast,
  prefersReducedMotion,
  prefersReducedTransparency,
} from './env';
import { attemptsIosSwitchHaptics } from './haptics';

const readSafeArea = (): Record<string, string> => {
  const cs = getComputedStyle(document.body);
  const out: Record<string, string> = {};
  for (const side of ['top', 'bottom', 'left', 'right']) {
    out[side] = cs.getPropertyValue(`--safe-area-${side}`).trim() || '?';
  }
  // The tokens above are var() chains; resolve the bottom inset to px.
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;height:var(--safe-area-bottom, env(safe-area-inset-bottom, 0px))';
  document.body.appendChild(probe);
  out.bottomPx = `${probe.getBoundingClientRect().height}px`;
  probe.remove();
  return out;
};

export const collectDiagnostics = (pluginVersion: string): LgxDiagnostics => {
  const selectors: Record<string, boolean> = {};
  for (const [name, sel] of Object.entries(SEL)) {
    if (name === 'scrollIgnore' || name === 'glowTargets') continue;
    selectors[`${name}: ${sel}`] = !!document.querySelector(sel);
  }

  return {
    pluginVersion,
    themeVersion: getComputedStyle(document.body)
      .getPropertyValue('--lgx-theme-version')
      .trim()
      .replace(/^['"]|['"]$/g, ''),
    bundledThemeVersion: BUNDLED_THEME_VERSION,
    themeSource: (() => {
      const bundled = !!document.getElementById(THEME_STYLE_ID);
      const installed = isInstalledThemeOurs();
      return bundled && installed ? 'both' : bundled ? 'bundled' : installed ? 'installed' : 'none';
    })(),
    compose: lastComposeSnapshot(),
    userAgent: navigator.userAgent,
    bodyClasses: [...document.body.classList].sort(),
    isThemeActive: isThemeActive(),
    support: {
      tabBar: hasTabBar(),
      hapticsAndroid: isAndroidApp(),
      hapticsIosSwitch: attemptsIosSwitchHaptics(),
      dynamicType: isIOS(),
      reducedTransparency: prefersReducedTransparency(),
      reducedMotion: prefersReducedMotion(),
      increasedContrast: prefersIncreasedContrast(),
    },
    dynamicTypeBodyPx: measureDynamicTypeBodyPx(),
    selectors,
    safeArea: readSafeArea(),
  };
};
