// Smoke test: preview page + dist/plugin.js run the way the host runs it,
// against a mock PluginAPI. Screenshots: $SHOTS_DIR or /tmp/liquid-glass-shots.
// Note: headless WebKit does not render backdrop-filter, so screenshots show
// no blur; geometry and behaviour checks are what this test is for.
import { webkit, chromium, devices } from 'playwright';
import fs from 'node:fs';

const PROJECT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const PREVIEW = `file://${PROJECT}/preview/ios-preview.html`;
const PLUGIN_JS = fs.readFileSync(`${PROJECT}/plugin/dist/plugin.js`, 'utf8');
const OUT = process.env.SHOTS_DIR || '/tmp/liquid-glass-shots';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'] });

// --- 1. Theme screenshots, no plugin ---------------------------------------
for (const [name, qs] of [
  ['light', ''],
  ['dark', '?dark=1'],
  ['compose-light', '?compose=1'],
  ['compose-dark', '?compose=1&dark=1'],
]) {
  const page = await ctx.newPage();
  await page.goto(PREVIEW + qs);
  await page.waitForTimeout(300);
  if (!name.startsWith('compose')) {
    // scroll so a colourful card sits under the tab bar
    await page.evaluate(() => (document.querySelector('work-view .today').scrollTop = 260));
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `${OUT}/theme-${name}.png` });
  await page.close();
}

// --- 2. Geometry ----------------------------------------------------------
{
  const page = await ctx.newPage();
  await page.goto(PREVIEW);
  const g = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
    const cs = getComputedStyle(document.querySelector('.main-content'));
    const today = document.querySelector('work-view .today');
    return {
      vw: innerWidth,
      vh: innerHeight,
      nav: r('.mobile-bottom-nav'),
      fab: r('.mobile-bottom-nav .add-task-button'),
      mainPaddingBottom: cs.paddingBottom,
      todayPaddingBottom: getComputedStyle(today).paddingBottom,
      todayBottom: today.getBoundingClientRect().bottom,
    };
  });
  check('tab bar is a capsule inset 16px', Math.round(g.nav.left) === 16, `left=${g.nav.left}`);
  check('tab bar height 62px', Math.round(g.nav.height) === 62, `h=${g.nav.height}`);
  check(
    'add button right edge inset 16px',
    Math.round(g.vw - g.fab.right) === 16,
    `right gap=${g.vw - g.fab.right}`,
  );
  check('add button is 62px circle', Math.round(g.fab.width) === 62 && Math.round(g.fab.height) === 62);
  check(
    'gap tab bar → add button is 10px',
    Math.round(g.fab.left - g.nav.right) === 10,
    `gap=${g.fab.left - g.nav.right}`,
  );
  check('content runs under tab bar (main padding 0)', g.mainPaddingBottom === '0px', g.mainPaddingBottom);
  check(
    'scroll list reaches screen bottom',
    Math.round(g.todayBottom) === g.vh,
    `list bottom=${g.todayBottom} vh=${g.vh}`,
  );
  check('list reserves space for last item', parseFloat(g.todayPaddingBottom) >= 150, g.todayPaddingBottom);
  await page.close();
}

const bootPlugin = async (page) => {
  await page.evaluate((code) => {
    const store = { data: null };
    const hooks = {};
    window.__lgx = { store, hooks, unload: null, onMessage: null, logs: [] };
    const api = {
      Hooks: { PERSISTED_DATA_CHANGED: 'persistedDataChanged', WORK_CONTEXT_CHANGE: 'workContextChange' },
      log: {
        info: (...a) => window.__lgx.logs.push(['info', ...a]),
        err: (...a) => window.__lgx.logs.push(['err', ...a.map(String)]),
      },
      loadSyncedData: async () => store.data,
      persistDataSynced: async (d) => {
        store.data = d;
        hooks.persistedDataChanged?.();
      },
      registerHook: (h, fn) => (hooks[h] = fn),
      onMessage: (fn) => (window.__lgx.onMessage = fn),
      onUnload: (fn) => (window.__lgx.unload = fn),
      onReady: (fn) => setTimeout(fn, 0),
    };
    new Function('plugin', 'PluginAPI', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      `'use strict';\n${code}`)(api, api, setTimeout, setInterval, clearTimeout, clearInterval);
  }, PLUGIN_JS);
  await page.waitForTimeout(200);
};

// --- 3. Plugin runtime ------------------------------------------------------
{
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check('no page errors', false, e.message));
  await page.goto(PREVIEW);
  await page.evaluate(() => document.body.classList.add('lgx-refract'));
  await bootPlugin(page);
  await page.waitForTimeout(200);

  const body = () => page.evaluate(() => [...document.body.classList]);
  let cls = await body();
  check('plugin started: body.lgx-on', cls.includes('lgx-on'));
  check('legacy lgx-refract left by an old build is removed', !cls.includes('lgx-refract'));
  check('press glow class on by default', cls.includes('lgx-glow'));
  check('plugin style injected', await page.evaluate(() => !!document.getElementById('lgx-plugin-style')));
  check(
    'startup logged without errors',
    await page.evaluate(() => !window.__lgx.logs.some((l) => l[0] === 'err')),
    JSON.stringify(await page.evaluate(() => window.__lgx.logs)),
  );

  // scroll down in steps → minimized
  for (let y = 40; y <= 400; y += 40) {
    await page.evaluate((v) => (document.querySelector('work-view .today').scrollTop = v), y);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(600);
  cls = await body();
  check('scroll down minimizes tab bar', cls.includes('lgx-tabbar-min'));
  const min = await page.evaluate(() => ({
    nav: document.querySelector('.mobile-bottom-nav').getBoundingClientRect().toJSON(),
    fab: document.querySelector('.mobile-bottom-nav .add-task-button').getBoundingClientRect().toJSON(),
  }));
  check('minimized capsule is a 62px circle', Math.round(min.nav.width) === 62, `w=${min.nav.width}`);
  check('add button does not move when minimized', Math.round(393 - min.fab.right) === 16, `right gap=${393 - min.fab.right}`);
  await page.screenshot({ path: `${OUT}/plugin-minimized.png` });

  // scroll up → expanded
  for (let y = 360; y >= 200; y -= 40) {
    await page.evaluate((v) => (document.querySelector('work-view .today').scrollTop = v), y);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(600);
  check('scroll up expands tab bar', !(await body()).includes('lgx-tabbar-min'));

  // messaging
  const state = await page.evaluate(() => window.__lgx.onMessage({ type: 'getState' }));
  check('getState returns settings', state?.settings?.glass === 'regular');
  check('diagnostics: theme detected', state?.diagnostics?.isThemeActive === true);
  check('diagnostics: selectors resolve', state?.diagnostics?.selectors['tabBar: .mobile-bottom-nav'] === true);

  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { glass: 'tinted', pressGlow: false } }));
  cls = await body();
  check('setSettings applies glass preset', cls.includes('lgx-glass-tinted'));
  check('setSettings turns glow off', !cls.includes('lgx-glow'));
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { refraction: true } }));
  check('legacy refraction setting is ignored', !(await body()).includes('lgx-refract'));

  check('settings persisted', JSON.parse(await page.evaluate(() => window.__lgx.store.data)).glass === 'tinted');

  // app rewriting body classes → plugin restores its own
  await page.evaluate(() => (document.body.className = 'hasMobileBottomNav isTouchPrimary isNativeMobile isIOS'));
  await page.waitForTimeout(100);
  check('body class guard restores lgx-on', (await body()).includes('lgx-on'));

  // unload
  await page.evaluate(() => window.__lgx.unload());
  await page.waitForTimeout(100);
  cls = await body();
  check('unload removes lgx-* classes', !cls.some((c) => c.startsWith('lgx-')), cls.join(' '));
  check('unload removes style', await page.evaluate(() => !document.getElementById('lgx-plugin-style')));
  await page.close();
}

// --- 4. Add-task window (compose card) -------------------------------------
for (const [label, qs, ctxOpts] of [
  ['touch', '?compose=1', { ...devices['iPhone 15 Pro'] }],
  ['desktop', '?compose=1&touch=0', { viewport: { width: 1280, height: 800 } }],
]) {
  const c = await browser.newContext(ctxOpts);
  const page = await c.newPage();
  await page.goto(PREVIEW + qs);
  await bootPlugin(page);
  const st = await page.evaluate(() => {
    const el = document.querySelector('add-task-bar.global .add-task-container');
    const cs = getComputedStyle(el);
    const btn = getComputedStyle(document.querySelector('.add-task-submit-btn'));
    return { radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, btnRadius: btn.borderTopLeftRadius };
  });
  // concentric with the round submit button: button/2 + 8px padding
  const want = label === 'touch' ? '30px' : '28px';
  check(`${label}: compose card radius is concentric (${want})`, st.radius === want, st.radius);
  check(`${label}: compose card is translucent glass`, /rgba\(.*0\.8\d?\)/.test(st.bg), st.bg);
  check(`${label}: submit button is round`, st.btnRadius === '50%', st.btnRadius);
  await page.focus('add-task-bar.global textarea');
  await page.waitForTimeout(150);
  const diag = (await page.evaluate(() => window.__lgx.onMessage({ type: 'getState' }))).diagnostics;
  check(`${label}: diagnostics reports theme version`, diag.themeVersion === '1.0.0', diag.themeVersion);
  check(`${label}: compose probe captured the window`, diag.compose?.themeApplied === true,
    JSON.stringify(diag.compose?.container));
  await page.screenshot({ path: `${OUT}/compose-${label}.png` });
  await c.close();
}

// --- 5. Sub-task corners + task card materials -------------------------------
{
  const page = await ctx.newPage();
  await page.goto(PREVIEW);
  const radii = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('task .sub-tasks .box')];
    const r = (el) => getComputedStyle(el);
    return {
      firstTop: r(boxes[0]).borderTopLeftRadius,
      firstBottom: r(boxes[0]).borderBottomLeftRadius,
      middle: r(boxes[1]).borderTopLeftRadius,
      lastBottom: r(boxes.at(-1)).borderBottomRightRadius,
    };
  });
  check('sub-task block: first row top corners rounded', radii.firstTop === '14px', radii.firstTop);
  check('sub-task block: middle rows square', radii.middle === '0px', radii.middle);
  check('sub-task block: last row bottom corners rounded', radii.lastBottom === '14px', radii.lastBottom);
  check('sub-task block: first row bottom stays square', radii.firstBottom === '0px', radii.firstBottom);

  await bootPlugin(page);
  const bg = async () => {
    await page.waitForTimeout(400); // theme transitions task backgrounds
    return page.evaluate(() => {
      const box = document.querySelector('work-view .today > task:not(.parent) > .box');
      const cs = getComputedStyle(box);
      return { bg: cs.backgroundColor, bf: cs.backdropFilter || cs.webkitBackdropFilter || 'none' };
    });
  };
  const solid = await bg();
  // ≤ 0.7 task card settings are dropped: cards are always solid
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { taskCards: 'frosted' } }));
  const mig = await page.evaluate(() => window.__lgx.onMessage({ type: 'getState' }));
  check('legacy taskCards setting is dropped', !('taskCards' in mig.settings), JSON.stringify(mig.settings).slice(0, 60));
  const after = await bg();
  check('task cards stay solid', after.bg === solid.bg && after.bf === 'none', after.bg);
  await page.close();
}

// --- 6. Plugin only: bundled theme, no installed theme ------------------------
{
  const page = await ctx.newPage();
  await page.goto(PREVIEW + '?notheme=1');
  const before = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--lgx-tabbar-h').trim());
  check('without plugin and theme: no theme tokens', before === '', before);
  await bootPlugin(page);
  const st = (await page.evaluate(() => window.__lgx.onMessage({ type: 'getState' }))).diagnostics;
  check('plugin alone activates the theme', st.isThemeActive === true);
  check('theme source is bundled', st.themeSource === 'bundled', st.themeSource);
  check('bundled theme version reported', st.bundledThemeVersion === '1.0.0', st.bundledThemeVersion);
  const nav = await page.evaluate(() => document.querySelector('.mobile-bottom-nav').getBoundingClientRect().height);
  check('bundled theme styles the tab bar', Math.round(nav) === 62, `h=${nav}`);
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { wallpaper: 'aurora' } }));
  await page.waitForTimeout(200);
  check('wallpaper class applied', (await page.evaluate(() => document.body.className)).includes('lgx-wp-aurora'));
  await page.screenshot({ path: `${OUT}/bundled-aurora.png` });
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { bundledTheme: false } }));
  await page.waitForTimeout(200);
  check('bundled theme can be switched off', await page.evaluate(() => !document.getElementById('lgx-bundled-theme')));
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { bundledTheme: true } }));
  await page.evaluate(() => window.__lgx.unload());
  await page.waitForTimeout(100);
  check('unload removes bundled theme', await page.evaluate(() => !document.getElementById('lgx-bundled-theme')));
  await page.close();
}

// --- 7. Colours, custom wallpapers, plugin iframes ----------------------------
{
  const page = await ctx.newPage();
  await page.goto(PREVIEW + '?compose=1');
  await bootPlugin(page);
  const msg = (m) => page.evaluate((x) => window.__lgx.onMessage(x), m);

  await msg({ type: 'setSettings', payload: { accent: '#af52de' } });
  const col = await page.evaluate(() => ({
    p500: document.body.style.getPropertyValue('--palette-primary-500'),
    p500rgb: document.body.style.getPropertyValue('--palette-primary-500-no-rgb'),
    syntax: getComputedStyle(document.querySelector('add-task-bar')).getPropertyValue('--lgx-syntax').trim(),
    tint: getComputedStyle(document.querySelector('add-task-bar')).getPropertyValue('--lgx-tint').trim(),
    submit: getComputedStyle(document.querySelector('.add-task-submit-btn')).backgroundColor,
  }));
  check('accent sets the primary palette', col.p500 === 'rgb(175, 82, 222)', col.p500);
  check('accent sets -no-rgb channels', col.p500rgb === '175, 82, 222', col.p500rgb);
  check('accent reaches the submit button', col.submit === 'rgb(175, 82, 222)', col.submit);
  check('short-syntax highlight follows the accent', /var\(--lgx-tint\)|175, 82, 222/.test(col.syntax) || col.syntax === col.tint, `${col.syntax} / ${col.tint}`);
  await msg({ type: 'setSettings', payload: { accent: 'red; } body { display:none' } });
  const bad = await page.evaluate(() => document.body.style.getPropertyValue('--palette-primary-500'));
  check('invalid accent is rejected (no override)', bad === '', bad);

  const wp = {
    id: 'wp-test', name: 'Test', angle: 135, light: ['#ffeedd', '#ddeeff'], dark: ['#101020', '#000000'],
    blobs: [{ color: '#ff2d55', x: 20, y: 20, size: 60, opacity: 0.5 }],
    pattern: 'dots', patternOpacity: 0.1, patternSize: 16,
  };
  const rendered = await msg({ type: 'renderWallpaper', payload: wp });
  check('renderWallpaper returns light + dark CSS', /linear-gradient\(135deg, #ffeedd, #ddeeff\)/.test(rendered.light) && /#101020/.test(rendered.dark), rendered.light?.slice(0, 80));
  const evil = await msg({ type: 'renderWallpaper', payload: { ...wp, light: ['#fff;}body{display:none}', '#000000'] } });
  check('wallpaper colours are sanitized', !/display:none/.test(JSON.stringify(evil)), JSON.stringify(evil).slice(0, 80));
  await msg({ type: 'setSettings', payload: { customWallpapers: [wp], wallpaper: 'custom:wp-test' } });
  await page.waitForTimeout(150);
  const applied = await page.evaluate(() => ({
    cls: document.body.className.includes('lgx-wp-custom'),
    css: document.getElementById('lgx-custom-wallpaper')?.textContent ?? '',
    bg: getComputedStyle(document.body).backgroundImage.slice(0, 60),
  }));
  check('custom wallpaper applied', applied.cls && applied.css.includes('#ffeedd'), applied.bg);
  const state = await msg({ type: 'getState' });
  check('state carries wallpaper previews', !!state.wallpaperPreviews['wp-test']?.light);
  await msg({ type: 'setSettings', payload: { wallpaper: 'custom:does-not-exist' } });
  check('unknown custom wallpaper falls back', !(await page.evaluate(() => document.body.className)).includes('lgx-wp-custom'));

  // a plugin iframe (same-origin, carries the host's injected tokens)
  await page.evaluate(() => {
    const f = document.createElement('iframe');
    f.id = 'fake-plugin';
    f.srcdoc = '<html><head><style id="injected-theme-vars">:root{--card-bg: rgba(255,255,255,0.3)}</style></head><body><dialog open>hi</dialog></body></html>';
    document.body.appendChild(f);
  });
  await page.waitForTimeout(400);
  const fr = await page.evaluate(() => {
    const doc = document.getElementById('fake-plugin').contentDocument;
    return {
      style: !!doc.getElementById('lgx-iframe-surface'),
      cardBg: getComputedStyle(doc.documentElement).getPropertyValue('--card-bg').trim(),
      dialogBg: getComputedStyle(doc.querySelector('dialog')).backgroundColor,
    };
  });
  check('plugin iframe gets an opaque card surface', fr.style && /^#|rgb\(/.test(fr.cardBg), fr.cardBg);
  check('plugin iframe dialog is dense glass', /0\.8\d|rgb\(/.test(fr.dialogBg), fr.dialogBg);
  await page.evaluate(() => window.__lgx.unload());
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => ({
    iframe: !!document.getElementById('fake-plugin').contentDocument.getElementById('lgx-iframe-surface'),
    accent: document.body.style.getPropertyValue('--palette-primary-500'),
  }));
  check('unload cleans plugin iframes and inline colours', !after.iframe && after.accent === '', JSON.stringify(after));
  await page.close();
}

// --- 8. Scroll edge effect -----------------------------------------------------
{
  const page = await ctx.newPage();
  await page.goto(PREVIEW);
  await bootPlugin(page);
  const st = () => page.evaluate(() => {
    const t = document.querySelector('work-view .today');
    return { body: document.body.className, fade: t.classList.contains('lgx-edge-fade'), mask: getComputedStyle(t).maskImage || getComputedStyle(t).webkitMaskImage };
  });
  check('scroll edge soft by default', (await st()).body.includes('lgx-edge-soft'));
  check('no edge at rest', !(await st()).fade);
  await page.evaluate(() => (document.querySelector('work-view .today').scrollTop = 120));
  await page.waitForTimeout(200);
  const on = await st();
  check('scrolling fades the scroller top', on.fade && /linear-gradient/.test(on.mask), on.mask);
  await page.evaluate(() => (document.querySelector('work-view .today').scrollTop = 0));
  await page.waitForTimeout(200);
  check('back at the top clears the edge', !(await st()).fade);
  // plugin iframe scrolling
  await page.evaluate(() => {
    const f = document.createElement('iframe');
    f.id = 'scroll-plugin';
    f.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px';
    f.srcdoc = '<html><head><style id="injected-theme-vars">:root{}</style></head><body><div style="height:2000px">x</div></body></html>';
    document.body.appendChild(f);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('scroll-plugin').contentWindow.scrollTo(0, 300));
  await page.waitForTimeout(300);
  check('scrolling inside a plugin iframe fades the iframe', await page.evaluate(() => document.getElementById('scroll-plugin').classList.contains('lgx-edge-fade')));
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { scrollEdge: 'off' } }));
  await page.evaluate(() => (document.querySelector('work-view .today').scrollTop = 120));
  await page.waitForTimeout(200);
  const off = await st();
  check('scroll edge can be switched off', !off.body.includes('lgx-edge-') && !off.fade);
  await page.close();
}

// --- 9. Plugin iframes in dark mode stay transparent ---------------------------
{
  const page = await ctx.newPage();
  await page.goto(PREVIEW + '?dark=1&notheme=1');
  await bootPlugin(page);
  await page.evaluate(() => {
    const f = document.createElement('iframe');
    f.id = 'dark-plugin';
    f.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;border:0;z-index:9999';
    f.srcdoc = '<html><head><style id="injected-theme-vars">:root{}</style></head><body style="background:transparent;color:#eee">plugin page</body></html>';
    document.body.appendChild(f);
  });
  await page.waitForTimeout(400);
  const buf = await page.screenshot({ clip: { x: 150, y: 150, width: 1, height: 1 } });
  const px = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d');
    x.drawImage(img, 0, 0); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, buf.toString('base64'));
  check('dark mode: plugin iframe is not painted white', px.every((v) => v < 120), px.join(','));
  await page.close();
}

// --- 10. Liquid Glass audit fixes (docs/liquid-glass-fixes.md) ---------------
{
  // accent pairs + high contrast
  const page = await ctx.newPage();
  await page.goto(PREVIEW);
  await bootPlugin(page);
  const p500 = () => page.evaluate(() => document.body.style.getPropertyValue('--palette-primary-500'));
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { accent: '#007aff' } }));
  check('system blue in light mode is #007AFF', (await p500()) === 'rgb(0, 122, 255)', await p500());
  await page.evaluate(() => { document.body.classList.add('isDarkTheme'); document.body.classList.remove('isLightTheme'); });
  await page.waitForTimeout(100);
  check('system blue in dark mode is #0A84FF', (await p500()) === 'rgb(10, 132, 255)', await p500());
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { accent: '#3366aa' } }));
  const st = await page.evaluate(() => window.__lgx.onMessage({ type: 'getState' }));
  check('custom accent gets a lighter derived dark variant', st.accentVariants && st.accentVariants.dark !== '#3366aa' && st.accentVariants.light === '#3366aa', JSON.stringify(st.accentVariants));
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { accentDark: '#88aaff' } }));
  check('accent also drives the app accent palette (play while tracking)', await page.evaluate(() => document.body.style.getPropertyValue('--palette-accent-500')) === (await p500()) && await page.evaluate(() => document.body.style.getPropertyValue('--c-accent')) === 'var(--palette-accent-500)');
  check('custom dark variant can be set', (await p500()) === 'rgb(136, 170, 255)', await p500());
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { accent: '#ff9500' } }));
  const st2 = await page.evaluate(() => window.__lgx.onMessage({ type: 'getState' }));
  check('picking a system colour clears the custom dark variant', st2.settings.accentDark === '', st2.settings.accentDark);
  // sidebar / chips: no tint fill
  const misc = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    return {
      lens: b.getPropertyValue('--lgx-glass-lens').trim(),
      prominent: b.getPropertyValue('--lgx-glass-prominent-shadow'),
    };
  });
  check('prominent shadow is neutral (no tint glow)', !/color-mix/.test(misc.prominent), misc.prominent.slice(0, 80));
  await page.close();
}
{
  // increased contrast → HC accent + outlines
  const c = await browser.newContext({ ...devices['iPhone 15 Pro'], contrast: 'more' });
  const page = await c.newPage();
  await page.goto(PREVIEW);
  await bootPlugin(page);
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { accent: '#007aff' } }));
  const p = await page.evaluate(() => document.body.style.getPropertyValue('--palette-primary-500'));
  check('increased contrast: system blue uses #0040DD', p === 'rgb(0, 64, 221)', p);
  const ol = await page.evaluate(() => getComputedStyle(document.querySelector('.mobile-bottom-nav')).outlineStyle);
  check('increased contrast: tab bar outlined', ol === 'solid', ol);
  const diag = (await page.evaluate(() => window.__lgx.onMessage({ type: 'getState' }))).diagnostics;
  check('diagnostics reports increased contrast', diag.support.increasedContrast === true);
  await c.close();
}
{
  // reduced transparency → solid tab bar (incl. tab bar token)
  const c = await browser.newContext({ ...devices['iPhone 15 Pro'] });
  const page = await c.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(PREVIEW);
  // headless browsers can't emulate prefers-reduced-transparency, and the
  // linked theme isn't readable via CSSOM on file:// — check the built CSS.
  const themeCss = fs.readFileSync(`${PROJECT}/themes/ios-liquid-glass.css`, 'utf8');
  const rtBlock = themeCss.slice(themeCss.lastIndexOf('@media (prefers-reduced-transparency: reduce)'));
  const solidNav = {
    tabbar: /--lgx-tabbar-bg:\s*#f9f9f9/.test(rtBlock),
    chrome: /--lgx-chrome-bg:\s*#f5f7fa/.test(rtBlock),
    menu: /--lgx-menu-bg:\s*#ffffff/.test(rtBlock),
  };
  check('reduce transparency: tab bar, chrome and menu tokens go solid', solidNav.tabbar && solidNav.chrome && solidNav.menu, JSON.stringify(solidNav));
  const navBg = await page.evaluate(() => getComputedStyle(document.querySelector('.mobile-bottom-nav')).backgroundColor);
  check('tab bar uses --lgx-tabbar-bg (not overridden on the element)', await page.evaluate(() => !/--lgx-glass-bg/.test(document.querySelector('.mobile-bottom-nav').getAttribute('style') || '')) && /rgba/.test(navBg), navBg);
  // glass presets reach the tab bar
  await bootPlugin(page);
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { glass: 'tinted' } }));
  const tinted = await page.evaluate(() => getComputedStyle(document.querySelector('.mobile-bottom-nav')).backgroundColor);
  check('glass preset changes the tab bar fill', tinted === 'rgba(255, 255, 255, 0.72)', tinted);
  // selected tab: no outer shadow
  const act = await page.evaluate(() => getComputedStyle(document.querySelector('.mobile-bottom-nav .nav-button.active')).boxShadow);
  check('selected tab has no drop shadow (flat lens)', !/\d+px \d+px 8px/.test(act) && !/0px 2px 8px/.test(act), act);
  // bottom scroll edge
  await page.evaluate(() => { const t = document.querySelector('work-view .today'); t.scrollTop = 40; });
  await page.waitForTimeout(250);
  const bot = await page.evaluate(() => { const t = document.querySelector('work-view .today'); return { cls: t.classList.contains('lgx-edge-fade-bottom'), mask: getComputedStyle(t).maskImage || getComputedStyle(t).webkitMaskImage }; });
  check('bottom scroll edge under the tab bar while more content below', bot.cls && /linear-gradient/.test(bot.mask), bot.mask);
  await page.evaluate(() => { const t = document.querySelector('work-view .today'); t.scrollTop = t.scrollHeight; });
  await page.waitForTimeout(250);
  check('bottom scroll edge clears at the end', await page.evaluate(() => !document.querySelector('work-view .today').classList.contains('lgx-edge-fade-bottom')));
  await c.close();
}

// --- Plugin iframes: override only with the Liquid Glass theme active ------
const addIframe = (page, id, html) =>
  page.evaluate(
    ([id, html]) =>
      new Promise((res) => {
        const f = document.createElement('iframe');
        f.id = id;
        f.onload = () => res();
        f.srcdoc = html;
        document.body.appendChild(f);
      }),
    [id, html],
  );
const PLUGIN_FRAME =
  '<!doctype html><html><head><style id="injected-theme-vars">:root{--card-bg:#123456}</style></head>' +
  '<body><dialog open>hi</dialog></body></html>';
const LONG_FRAME = '<!doctype html><html><body><div style="height:3000px"></div></body></html>';
{
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check('no page errors (iframes)', false, e.message));
  await page.goto(PREVIEW + '?notheme=1');
  await bootPlugin(page);
  await addIframe(page, 'plug', PLUGIN_FRAME);
  await page.waitForTimeout(100);
  const frame = () =>
    page.evaluate(() => {
      const doc = document.getElementById('plug').contentDocument;
      return {
        patched: !!doc.getElementById('lgx-iframe-surface'),
        cardBg: getComputedStyle(doc.documentElement).getPropertyValue('--card-bg').trim(),
      };
    });
  let f = await frame();
  check('bundled theme on: plugin iframe gets the glass surface override', f.patched, JSON.stringify(f));
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { bundledTheme: false } }));
  f = await frame();
  check(
    'bundled theme off: plugin iframe keeps its own theme tokens',
    !f.patched && f.cardBg === '#123456',
    JSON.stringify(f),
  );
  await addIframe(page, 'plug2', PLUGIN_FRAME);
  await page.waitForTimeout(100);
  check(
    'bundled theme off: newly opened plugin iframe is not patched',
    await page.evaluate(() => !document.getElementById('plug2').contentDocument.getElementById('lgx-iframe-surface')),
  );
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { bundledTheme: true } }));
  check('bundled theme back on: override restored', (await frame()).patched);

  // a navigation click right before the scroll edge slot stops must not
  // hook iframes into the stopped slot
  await page.evaluate(() => document.body.click());
  await page.evaluate(() => window.__lgx.onMessage({ type: 'setSettings', payload: { scrollEdge: 'off' } }));
  await addIframe(page, 'late', LONG_FRAME);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('late').contentWindow.scrollTo(0, 200));
  await page.waitForTimeout(200);
  check(
    'scroll edge off: a pending click timer does not re-hook iframes',
    await page.evaluate(() => !document.getElementById('late').classList.contains('lgx-edge-fade')),
  );
  await page.close();
}

await browser.close();

// --- Memory: no detached DOM kept alive (Chromium, forced GC) --------------
{
  let cb = null;
  try {
    cb = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
  } catch (e) {
    console.log(`- skipped GC checks: Chromium not available (npx playwright install chromium)`);
  }
  if (cb) {
    const page = await cb.newPage({ viewport: { width: 393, height: 852 } });
    page.on('pageerror', (e) => check('no page errors (gc)', false, e.message));
    await page.goto(PREVIEW);
    await bootPlugin(page);
    const collected = async (expr) => {
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.gc());
        await page.waitForTimeout(50);
      }
      return page.evaluate(expr);
    };

    // a routed page scroller that got the fade, then removed by navigation
    await page.evaluate(() => {
      const s = document.createElement('div');
      s.id = 'leak-s';
      Object.assign(s.style, { position: 'absolute', inset: '0', overflowY: 'auto' });
      s.innerHTML = '<div style="height:3000px"></div>';
      document.querySelector('.route-wrapper').appendChild(s);
      s.scrollTop = 100;
    });
    await page.waitForTimeout(200);
    check(
      'gc: test scroller got the edge fade',
      await page.evaluate(() => document.getElementById('leak-s').classList.contains('lgx-edge-fade')),
    );
    await page.evaluate(() => {
      const s = document.getElementById('leak-s');
      window.__sref = new WeakRef(s);
      s.remove();
    });
    await page.waitForTimeout(100);
    check('gc: removed page scroller is collected', await collected(() => window.__sref.deref() === undefined));

    // a plugin view iframe that was scrolled, then closed
    await addIframe(page, 'leak-f', LONG_FRAME);
    await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById('leak-f').contentWindow.scrollTo(0, 200));
    await page.waitForTimeout(200);
    check(
      'gc: test iframe got the edge fade',
      await page.evaluate(() => document.getElementById('leak-f').classList.contains('lgx-edge-fade')),
    );
    await page.evaluate(() => {
      const f = document.getElementById('leak-f');
      window.__wref = new WeakRef(f.contentWindow);
      window.__fref = new WeakRef(f);
      f.remove();
    });
    await page.waitForTimeout(100);
    check(
      'gc: closed plugin iframe and its window are collected',
      await collected(() => window.__fref.deref() === undefined && window.__wref.deref() === undefined),
    );
    await cb.close();
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
