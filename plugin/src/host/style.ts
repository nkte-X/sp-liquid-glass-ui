// CSS for states the plugin drives. The theme (themes/ios-liquid-glass.css)
// owns the look; everything here is keyed off `body.lgx-on` plus a feature
// class, so it does nothing without the plugin and wins over theme rules
// by specificity regardless of stylesheet order (themes are re-inserted on
// every theme switch, so order cannot be relied on).

export const STYLE_ID = 'lgx-plugin-style';

export const PLUGIN_CSS = /* css */ `
/* ---- Glass strength presets (chrome only) ---- */
body.lgx-on.lgx-glass-clear { --lgx-glass-bg: rgba(255, 255, 255, 0.3); --lgx-tabbar-bg: rgba(255, 255, 255, 0.26); }
body.lgx-on.lgx-glass-clear.isDarkTheme { --lgx-glass-bg: rgba(30, 30, 36, 0.34); --lgx-tabbar-bg: rgba(30, 30, 36, 0.32); }
body.lgx-on.lgx-glass-tinted { --lgx-glass-bg: rgba(255, 255, 255, 0.76); --lgx-tabbar-bg: rgba(255, 255, 255, 0.72); }
body.lgx-on.lgx-glass-tinted.isDarkTheme { --lgx-glass-bg: rgba(44, 44, 50, 0.8); --lgx-tabbar-bg: rgba(40, 40, 46, 0.78); }

/* ---- Wallpapers ----
 * Glass only reads as glass when there is colour behind it; the app's
 * default Today view ships with the background tint off, i.e. near-white.
 * \`html body…\` outranks the theme's body.isDisableBackgroundTint(.isDarkTheme)
 * wallpaper rules regardless of stylesheet order. */
html body.lgx-on.lgx-wp-aurora {
  --lg-wallpaper:
    radial-gradient(60% 50% at 12% 8%, rgba(88, 86, 214, 0.55), transparent 70%),
    radial-gradient(55% 45% at 92% 20%, rgba(0, 199, 190, 0.45), transparent 70%),
    radial-gradient(70% 55% at 70% 95%, rgba(175, 82, 222, 0.45), transparent 70%),
    linear-gradient(180deg, #eef1ff 0%, #e6ecfb 100%);
}
html body.lgx-on.isDarkTheme.lgx-wp-aurora {
  --lg-wallpaper:
    radial-gradient(60% 50% at 12% 8%, rgba(94, 92, 230, 0.6), transparent 70%),
    radial-gradient(55% 45% at 92% 20%, rgba(0, 160, 160, 0.45), transparent 70%),
    radial-gradient(70% 55% at 70% 95%, rgba(150, 60, 210, 0.55), transparent 70%),
    linear-gradient(180deg, #0b0c1a 0%, #05060d 100%);
}
html body.lgx-on.lgx-wp-ocean {
  --lg-wallpaper:
    radial-gradient(65% 55% at 10% 0%, rgba(0, 122, 255, 0.55), transparent 70%),
    radial-gradient(60% 50% at 95% 40%, rgba(90, 200, 250, 0.55), transparent 70%),
    radial-gradient(70% 60% at 30% 100%, rgba(52, 199, 89, 0.35), transparent 70%),
    linear-gradient(180deg, #e9f4ff 0%, #e2eefc 100%);
}
html body.lgx-on.isDarkTheme.lgx-wp-ocean {
  --lg-wallpaper:
    radial-gradient(65% 55% at 10% 0%, rgba(10, 100, 230, 0.6), transparent 70%),
    radial-gradient(60% 50% at 95% 40%, rgba(40, 150, 210, 0.5), transparent 70%),
    radial-gradient(70% 60% at 30% 100%, rgba(30, 140, 90, 0.4), transparent 70%),
    linear-gradient(180deg, #06121f 0%, #030910 100%);
}
html body.lgx-on.lgx-wp-sunset {
  --lg-wallpaper:
    radial-gradient(60% 50% at 8% 10%, rgba(255, 149, 0, 0.55), transparent 70%),
    radial-gradient(60% 50% at 90% 15%, rgba(255, 45, 85, 0.45), transparent 70%),
    radial-gradient(75% 60% at 60% 100%, rgba(175, 82, 222, 0.45), transparent 70%),
    linear-gradient(180deg, #fff3ec 0%, #fbeaf1 100%);
}
html body.lgx-on.isDarkTheme.lgx-wp-sunset {
  --lg-wallpaper:
    radial-gradient(60% 50% at 8% 10%, rgba(230, 120, 0, 0.55), transparent 70%),
    radial-gradient(60% 50% at 90% 15%, rgba(220, 30, 80, 0.5), transparent 70%),
    radial-gradient(75% 60% at 60% 100%, rgba(130, 50, 190, 0.55), transparent 70%),
    linear-gradient(180deg, #1a0b10 0%, #0c0508 100%);
}
html body.lgx-on.lgx-wp-graphite {
  --lg-wallpaper:
    radial-gradient(60% 50% at 15% 10%, rgba(142, 142, 147, 0.45), transparent 70%),
    radial-gradient(60% 50% at 90% 85%, rgba(99, 99, 102, 0.4), transparent 70%),
    linear-gradient(180deg, #ececf0 0%, #dedee3 100%);
}
html body.lgx-on.isDarkTheme.lgx-wp-graphite {
  --lg-wallpaper:
    radial-gradient(60% 50% at 15% 10%, rgba(120, 120, 128, 0.35), transparent 70%),
    radial-gradient(60% 50% at 90% 85%, rgba(72, 72, 74, 0.45), transparent 70%),
    linear-gradient(180deg, #1c1c1e 0%, #0d0d0f 100%);
}

/* ---- Tab bar minimize (iOS 26 tabBarMinimizeBehavior .onScrollDown) ----
 * The capsule shrinks to a circle holding only the selected tab. The add
 * button is anchored independently by the theme, so it stays in place. */
body.lgx-on.hasMobileBottomNav .mobile-bottom-nav {
  transition:
    right 0.5s var(--lgx-spring),
    transform 0.45s var(--lgx-spring),
    opacity 0.3s var(--lgx-ease);
}
body.lgx-on.hasMobileBottomNav .mobile-bottom-nav .nav-button {
  transition:
    flex-grow 0.45s var(--lgx-spring),
    flex-basis 0.45s var(--lgx-spring),
    opacity 0.2s var(--lgx-ease),
    background-color 0.25s var(--lgx-ease),
    transform 0.4s var(--lgx-spring) !important;
}
body.lgx-on.lgx-tabbar-min.hasMobileBottomNav .mobile-bottom-nav {
  right: calc(100vw - var(--safe-area-left) - var(--lgx-tabbar-inset) - var(--lgx-tabbar-h)) !important;
}
body.lgx-on.lgx-tabbar-min.hasMobileBottomNav .mobile-bottom-nav .nav-button:not(.active) {
  flex: 0 0 0 !important;
  min-width: 0 !important;
  padding: 0 !important;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}
body.lgx-on.lgx-tabbar-min.hasMobileBottomNav .mobile-bottom-nav .nav-button.active {
  --sidenav-item-active-bg: transparent;
}

/* ---- Press glow: light pooling under the finger ---- */
body.lgx-on.lgx-glow .lgx-pressing {
  background-image: radial-gradient(
    circle 72px at var(--lgx-px, 50%) var(--lgx-py, 50%),
    rgba(255, 255, 255, 0.5),
    transparent 70%
  ) !important;
}
body.lgx-on.lgx-glow.isDarkTheme .lgx-pressing {
  background-image: radial-gradient(
    circle 72px at var(--lgx-px, 50%) var(--lgx-py, 50%),
    rgba(255, 255, 255, 0.22),
    transparent 70%
  ) !important;
}

/* ---- Scroll edge effect (soft / hard) ----
 * Top: shown only while a region is scrolled. Bottom (with the floating tab
 * bar): shown while there is more content below. Classes set by
 * scroll-edge.ts.
 * Content: a mask on the scroller / plugin iframe fades what slides under
 * the top edge. Sidebar: a sticky gradient fades rows into the panel colour
 * under the traffic lights. No backdrop blur under a mask — that combination
 * rendered as a hard band on macOS. */
body.lgx-on.lgx-edge-soft {
  --lgx-edge-size: 30px;
  --lgx-edge-start: 0;
  /* sidebar: rows are gone under the traffic lights, back by this depth */
  --lgx-edge-clear: 14px;
  --lgx-edge-side-h: 54px;
}
body.lgx-on.lgx-edge-hard {
  --lgx-edge-size: 44px;
  --lgx-edge-start: 0;
  --lgx-edge-clear: 24px;
  --lgx-edge-side-h: 62px;
}

/* One mask, both edges: each edge is opaque (no fade) until its class is
 * set. Bottom: only with the floating tab bar, fading out toward its lower
 * edge so the capsule never sits on hard light content. */
body.lgx-on:is(.lgx-edge-soft, .lgx-edge-hard) :is(.lgx-edge-fade, .lgx-edge-fade-bottom) {
  --lgx-mt: 1;
  --lgx-mb: 1;
  --lgx-edge-b0: 0px;
  --lgx-edge-b1: 0px;
  -webkit-mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, var(--lgx-mt)) 0,
    #000 var(--lgx-edge-size),
    #000 calc(100% - var(--lgx-edge-b1)),
    rgba(0, 0, 0, var(--lgx-mb)) calc(100% - var(--lgx-edge-b0))
  );
  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, var(--lgx-mt)) 0,
    #000 var(--lgx-edge-size),
    #000 calc(100% - var(--lgx-edge-b1)),
    rgba(0, 0, 0, var(--lgx-mb)) calc(100% - var(--lgx-edge-b0))
  );
}
body.lgx-on:is(.lgx-edge-soft, .lgx-edge-hard) .lgx-edge-fade {
  --lgx-mt: var(--lgx-edge-start);
}
body.lgx-on.hasMobileBottomNav:is(.lgx-edge-soft, .lgx-edge-hard) .lgx-edge-fade-bottom {
  --lgx-mb: var(--lgx-edge-start);
  --lgx-edge-b0: var(--lgx-tabbar-bottom);
  --lgx-edge-b1: calc(var(--lgx-tabbar-bottom) + var(--lgx-tabbar-h) * var(--lgx-edge-b-k));
}
body.lgx-on.lgx-edge-soft { --lgx-edge-b-k: 0.5; }
body.lgx-on.lgx-edge-hard { --lgx-edge-b-k: 0.75; }

body.lgx-on:is(.lgx-edge-soft, .lgx-edge-hard) magic-side-nav .nav-sidenav.lgx-edge .nav-list {
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent calc(var(--lgx-vt, 0px) + var(--lgx-edge-clear)),
    #000 calc(var(--lgx-vt, 0px) + var(--lgx-edge-side-h))
  );
  mask-image: linear-gradient(
    to bottom,
    transparent calc(var(--lgx-vt, 0px) + var(--lgx-edge-clear)),
    #000 calc(var(--lgx-vt, 0px) + var(--lgx-edge-side-h))
  );
}

/* ---- Hidden haptic switch (iOS experimental) ---- */
#lgx-haptic {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  clip-path: inset(50%);
}

/* ---- Motion preferences ---- */
@media (prefers-reduced-motion: reduce) {
  body.lgx-on.hasMobileBottomNav .mobile-bottom-nav,
  body.lgx-on.hasMobileBottomNav .mobile-bottom-nav .nav-button {
    transition: none !important;
  }
}
body.lgx-on.isDisableAnimations .mobile-bottom-nav,
body.lgx-on.isDisableAnimations .mobile-bottom-nav .nav-button {
  transition: none !important;
}
`;
