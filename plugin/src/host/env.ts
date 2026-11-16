// Platform detection and the DOM selectors this plugin depends on.
// Every selector lives here so an app update that renames something is a
// one-file fix; diagnostics reports which of them currently resolve.

export const SEL = {
  tabBar: '.mobile-bottom-nav',
  tabButton: '.mobile-bottom-nav .nav-button',
  tabButtonActive: '.mobile-bottom-nav .nav-button.active',
  addButton: '.mobile-bottom-nav .add-task-button',
  header: 'main-header',
  headerGroup: 'main-header .header-action-group',
  pageTitle: 'main-header .page-title',
  doneToggle: 'done-toggle',
  /** Scroll containers whose scrolling must not drive the tab bar. */
  scrollIgnore:
    '.cdk-overlay-container, .mobile-bottom-nav, .bottom-panel-sheet, magic-side-nav, main-header',
  /** Glass controls that get the press glow. */
  glowTargets:
    '.mobile-bottom-nav .add-task-button, .mobile-bottom-nav, main-header .header-action-group',
} as const;

const body = (): HTMLElement => document.body;

export const has = (cls: string): boolean => body().classList.contains(cls);

export const isIOS = (): boolean => has('isIOS');
export const isAndroidApp = (): boolean =>
  typeof (window as unknown as { SUPAndroid?: unknown }).SUPAndroid === 'object';
export const hasTabBar = (): boolean => has('hasMobileBottomNav');

export const isChromium = (): boolean => {
  const brands = (navigator as unknown as { userAgentData?: { brands?: { brand: string }[] } })
    .userAgentData?.brands;
  if (brands?.some((b) => /Chromium/.test(b.brand))) return true;
  // Electron and desktop Chrome/Edge carry "Chrome/<n>". Chrome on iOS is
  // WebKit and says "CriOS" instead, so it is correctly excluded.
  return /\bChrome\/\d+/.test(navigator.userAgent);
};

export const mq = (q: string): boolean => {
  try {
    return window.matchMedia(q).matches;
  } catch {
    return false;
  }
};

export const prefersIncreasedContrast = (): boolean => mq('(prefers-contrast: more)');

/** Media queries the plugin's output depends on. The user can flip these in
 *  System Settings while the app is open. */
export const A11Y_QUERIES = [
  '(prefers-reduced-transparency: reduce)',
  '(prefers-reduced-motion: reduce)',
  '(prefers-contrast: more)',
] as const;

/** Call `cb` whenever any of the queries changes; unsubscribed on dispose. */
export const watchMedia = (
  d: { add: (fn: () => void) => void },
  queries: readonly string[],
  cb: () => void,
): void => {
  for (const q of queries) {
    let list: MediaQueryList;
    try {
      list = window.matchMedia(q);
    } catch {
      continue;
    }
    list.addEventListener('change', cb);
    d.add(() => list.removeEventListener('change', cb));
  }
};

export const prefersReducedTransparency = (): boolean =>
  mq('(prefers-reduced-transparency: reduce)');
export const prefersReducedMotion = (): boolean =>
  mq('(prefers-reduced-motion: reduce)') || has('isDisableAnimations');

/** True when themes/ios-liquid-glass.css is the active theme. */
export const isThemeActive = (): boolean =>
  getComputedStyle(body()).getPropertyValue('--lgx-tabbar-h').trim() !== '';
