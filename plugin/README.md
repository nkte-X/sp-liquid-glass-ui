# Liquid Glass UI — developer notes

The whole Liquid Glass look for Super Productivity as one plugin. The theme
`themes/ios-liquid-glass.css` is embedded into `plugin.js` at build time and
the plugin injects it into the app, so no separate theme install is needed.
One ZIP works on every platform; features switch themselves on or off
depending on the platform.

| Feature | Default | Where |
|---|---|---|
| Bundled Liquid Glass theme | on | everywhere |
| Wallpapers Theme / Aurora / Ocean / Sunset / Graphite (glass needs colour behind it) | Theme | everywhere |
| Custom wallpapers: editor with a base gradient for light and dark mode, colour blobs and a pattern (dots, grid, lines), live preview; up to 8 designs | — | everywhere |
| Accent colour: primary actions (add, send, play — also while tracking time), selected tab / sidebar icon, focus ring and the short-syntax highlight (p1, t10h, !at 3pm, #tag). Light / dark pair: system colours use Apple's values, a custom colour gets a derived dark variant or a manual one; high-contrast variant with Increase Contrast | app colour | everywhere |
| Opaque surface and a glass `<dialog>` inside other plugins' iframes | on | everywhere |
| Tab bar minimizes while scrolling down (like iOS 26) | on | wherever the mobile tab bar is shown |
| Press glow under the finger on glass controls | on | everywhere |
| Haptics: tabs, add, task done | on | Android (app bridge), iOS (experimental, via `<input switch>`) |
| Dynamic Type: font scale follows the iOS setting | off | iOS |
| Glass presets Clear / Regular / Tinted | Regular | everywhere (not with Reduce Transparency) |
| Scroll edge effect Off / Soft / Hard (like `scrollEdgeEffectStyle`): content fades under the top of the sidebar and the page; with the floating tab bar also at the bottom while more content follows | Soft | everywhere |
| Sheet state: at full height the sheet docks to the screen edges (`lgx-sheet-full`) | on | iOS |
| Diagnostics: `body` classes, selectors, safe area, Dynamic Type, Reduce Transparency / Motion / Increase Contrast (live, no restart) | — | settings page |

## Install

1. `npm install && npm run package` produces `liquid-glass-ui-<version>.zip`.
   The build compiles the theme first (`../themes/build.sh`).
2. In the app: Settings → Plugins → upload the ZIP and enable the plugin.
3. Settings → Theme: choose **Default**. If the standalone theme is also
   installed there, it loads twice: harmless but redundant; diagnostics then
   shows `themeSource: both`.
4. Settings and diagnostics: the **Liquid Glass UI** menu entry.

On app start the theme appears once the plugin has loaded, so the default
look may flash briefly. If that bothers you, also install the theme file via
Settings → Theme.

## Development

```
npm run build      # vite → dist/, then checks that plugin.js compiles as a host plugin
npm run typecheck
npm run smoke      # preview page + plugin.js with a mock PluginAPI in WebKit (iPhone 15 Pro), 87 checks
npm run package    # ZIP: manifest.json, plugin.js, index.html, icon.svg
npm run release    # smoke + package, prints the SHA-256 and the community listing entry
```

Layout:

```
src/plugin.ts              host entry (run via new Function): settings, feature slots, onUnload
src/host/*.ts              features: tab-bar, press-glow, haptics, dynamic-type, accent, wallpaper-css,
                           plugin-iframes, scroll-edge, sheet, diagnostics
src/host/env.ts            ALL app DOM selectors (an app update that renames something is a one-file fix)
src/host/style.ts          CSS for plugin-driven states (body.lgx-on + feature classes, wallpapers)
src/host/bundled-theme.ts  bundled theme (themes/ios-liquid-glass.css?raw)
src/protocol.ts            types only, shared by plugin.js and the UI
src/app/                   settings page (Solid, iframe), talks to plugin.js via PLUGIN_MESSAGE
tools/sp-vite-plugin.ts    copy of upstream packages/vite-plugin (MIT, not on npm)
```

Rules:

- `plugin.js` must stay a plain script. `src/plugin.ts` and `src/host/**`
  must not import runtime code from `src/app/**`, and may use only
  `import type` from `src/protocol.ts`. `npm run build` fails otherwise.
- If a selector is missing or an API is unavailable, the feature switches
  itself off quietly. One failing feature never stops the others.
- `onUnload` removes everything: listeners, observers, `<style>`, SVG,
  classes and inline variables.
- Haptics fire only from a user gesture, never from hooks or sync.

## Limitations

- iOS haptics can't be verified programmatically: turn them on and check
  whether you feel them.
- Settings sync across devices. Platform features simply don't start on
  devices that can't use them.
- The plugin relies on the app's DOM, not an official API. After an app
  update, check the Diagnostics section first.

## Removed

- **Task cards setting (1.0.0).** Task cards are always solid: rows are
  content, not glass. The old `taskCards` key is ignored.
- **Frosted task cards (0.7.0).** A live blur on every list row is glass in
  content (against the HIG) and costly on long lists.
- **Refraction (SVG lens).** Tested on the real app: in Chromium
  `backdrop-filter: url(#svg) blur()` stays in the computed style but the
  background is not blurred at all, so dialogs end up merely translucent. The
  old `refraction` key in synced settings is ignored.
