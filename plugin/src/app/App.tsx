import { For, Show, createSignal, onMount, type JSX } from 'solid-js';
import type {
  CustomWallpaper,
  GlassVariant,
  LgxSettings,
  LgxState,
  ScrollEdgeVariant,
  WallpaperVariant,
} from '../protocol';
import { send } from './bridge';
import { ColorPicker, SYSTEM_COLORS } from './ColorPicker';

const isSystemColor = (hex: string): boolean => SYSTEM_COLORS.some((c) => c.hex === hex);
import { WallpaperEditor, newWallpaper } from './WallpaperEditor';

type BoolKey = {
  [K in keyof LgxSettings]: LgxSettings[K] extends boolean ? K : never;
}[keyof LgxSettings];

const GLASS_OPTIONS: { value: GlassVariant; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'regular', label: 'Regular' },
  { value: 'tinted', label: 'Tinted' },
];

const SCROLL_EDGE_OPTIONS: { value: ScrollEdgeVariant; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'soft', label: 'Soft' },
  { value: 'hard', label: 'Hard' },
];

const WALLPAPERS: { value: WallpaperVariant; label: string; swatch: string }[] = [
  { value: 'theme', label: 'Theme', swatch: 'linear-gradient(135deg, #eef2f8, #dfe6f1)' },
  { value: 'aurora', label: 'Aurora', swatch: 'linear-gradient(135deg, #5856d6, #00c7be 55%, #af52de)' },
  { value: 'ocean', label: 'Ocean', swatch: 'linear-gradient(135deg, #007aff, #5ac8fa 55%, #34c759)' },
  { value: 'sunset', label: 'Sunset', swatch: 'linear-gradient(135deg, #ff9500, #ff2d55 55%, #af52de)' },
  { value: 'graphite', label: 'Graphite', swatch: 'linear-gradient(135deg, #8e8e93, #48484a)' },
];

/** iOS segmented control. */
const Segmented = <T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (v: T) => void;
}): JSX.Element => (
  <div class="segmented" role="radiogroup" aria-label={props.label}>
    <For each={props.options}>
      {(o) => (
        <button
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          classList={{ on: props.value === o.value }}
          disabled={props.disabled}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      )}
    </For>
  </div>
);

/** Native iOS switch where WebKit supports it; a checkbox elsewhere. */
const Switch = (props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element => (
  <input
    type="checkbox"
    class="switch"
    ref={(el) => el.setAttribute('switch', '')}
    checked={props.checked}
    disabled={props.disabled}
    onChange={(e) => props.onChange(e.currentTarget.checked)}
  />
);

const Row = (props: { title: string; note?: string; children: JSX.Element }): JSX.Element => (
  <label class="row">
    <span class="row-text">
      <span class="row-title">{props.title}</span>
      <Show when={props.note}>
        <span class="row-note">{props.note}</span>
      </Show>
    </span>
    {props.children}
  </label>
);

export default function App(): JSX.Element {
  const [state, setState] = createSignal<LgxState | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [editing, setEditing] = createSignal<{ w: CustomWallpaper; isNew: boolean } | null>(null);

  const saveWallpaper = (w: CustomWallpaper): void => {
    const list = s()!.customWallpapers.filter((x) => x.id !== w.id);
    setEditing(null);
    void update({ customWallpapers: [...list, w], wallpaper: `custom:${w.id}` });
  };
  const deleteWallpaper = (id: string): void => {
    const cur = s()!;
    setEditing(null);
    void update({
      customWallpapers: cur.customWallpapers.filter((x) => x.id !== id),
      wallpaper: cur.wallpaper === `custom:${id}` ? 'theme' : cur.wallpaper,
    });
  };

  const run = async (p: Promise<LgxState>): Promise<void> => {
    setBusy(true);
    try {
      setState(await p);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const refresh = (): Promise<void> => run(send({ type: 'getState' }));
  const update = (payload: Partial<LgxSettings>): Promise<void> =>
    run(send({ type: 'setSettings', payload }));

  onMount(refresh);

  const s = (): LgxSettings | undefined => state()?.settings;
  const d = () => state()?.diagnostics;

  const toggle = (key: BoolKey, title: string, note?: string, disabled?: () => boolean) => (
    <Row title={title} note={note}>
      <Switch
        checked={!!s()?.[key]}
        disabled={busy() || disabled?.()}
        onChange={(v) => update({ [key]: v })}
      />
    </Row>
  );

  return (
    <main class="page">
      <h1>Liquid Glass UI</h1>

      <Show when={error()}>
        <p class="banner banner-error">{error()}</p>
      </Show>

      <Show when={d() && !d()!.isThemeActive}>
        <p class="banner">
          The iOS Liquid Glass theme is not active. Turn on <b>Bundled theme</b> below.
        </p>
      </Show>

      <Show when={d()?.themeSource === 'both'}>
        <p class="banner">
          The theme is loaded twice (bundled + installed). Select <b>Default</b> in Settings →
          Theme to keep only the bundled copy.
        </p>
      </Show>

      <Show when={s()} fallback={<p class="muted">Loading…</p>}>
        <h2>Appearance</h2>
        <section class="group">
          {toggle(
            'bundledTheme',
            'Bundled theme',
            `iOS Liquid Glass ${d()?.bundledThemeVersion ?? ''} — no separate theme install needed.`,
          )}
          <div class="row-text pad">
            <span class="row-title">Wallpaper</span>
            <span class="row-note">Glass needs colour behind it to read as glass.</span>
          </div>
          <div class="swatches" role="radiogroup" aria-label="Wallpaper">
            <For each={WALLPAPERS}>
              {(w) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={s()!.wallpaper === w.value}
                  classList={{ swatch: true, on: s()!.wallpaper === w.value }}
                  disabled={busy()}
                  onClick={() => update({ wallpaper: w.value })}
                >
                  <span class="swatch-color" style={{ background: w.swatch }} />
                  <span class="swatch-label">{w.label}</span>
                </button>
              )}
            </For>
            <For each={s()!.customWallpapers}>
              {(cw) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={s()!.wallpaper === `custom:${cw.id}`}
                  classList={{ swatch: true, on: s()!.wallpaper === `custom:${cw.id}` }}
                  disabled={busy()}
                  onClick={() =>
                    s()!.wallpaper === `custom:${cw.id}`
                      ? setEditing({ w: cw, isNew: false })
                      : update({ wallpaper: `custom:${cw.id}` })
                  }
                  title="Tap again to edit"
                >
                  <span
                    class="swatch-color"
                    style={{
                      background:
                        (d()?.bodyClasses.includes('isDarkTheme')
                          ? state()?.wallpaperPreviews[cw.id]?.dark
                          : state()?.wallpaperPreviews[cw.id]?.light) ?? '#ccc',
                    }}
                  />
                  <span class="swatch-label">{cw.name}</span>
                </button>
              )}
            </For>
            <Show when={s()!.customWallpapers.length < 8}>
              <button
                type="button"
                class="swatch"
                disabled={busy()}
                onClick={() => setEditing({ w: newWallpaper(), isNew: true })}
              >
                <span class="swatch-color swatch-add">+</span>
                <span class="swatch-label">New</span>
              </button>
            </Show>
          </div>
        </section>

        <Show when={editing()} keyed>
          {(e) => (
            <>
              <h2>{e.isNew ? 'New wallpaper' : 'Edit wallpaper'}</h2>
              <WallpaperEditor
                initial={e.w}
                isNew={e.isNew}
                onSave={saveWallpaper}
                onDelete={deleteWallpaper}
                onCancel={() => setEditing(null)}
              />
            </>
          )}
        </Show>

        <h2>Colours</h2>
        <section class="group">
          <div class="row-text pad">
            <span class="row-title">Accent</span>
            <span class="row-note">
              The primary actions (add, send, play), the selected tab / sidebar icon, focus rings
              and the short-syntax highlight (p1, t10h, !at 3pm, #tag). System colours use
              Apple's light, dark and increased-contrast variants.
            </span>
          </div>
          <ColorPicker
            label="Accent colour"
            value={s()!.accent}
            disabled={busy()}
            defaultLabel="App / project colour"
            onChange={(accent) => update({ accent, accentDark: '' })}
          />
          <Show when={state()?.accentVariants && !isSystemColor(s()!.accent)}>
            <div class="field-row space pad accent-dark">
              <span class="field-label">Dark mode variant</span>
              <span class="accent-dark-controls">
                <button
                  type="button"
                  classList={{ 'link-btn': true, on: !s()!.accentDark }}
                  disabled={busy() || !s()!.accentDark}
                  onClick={() => update({ accentDark: '' })}
                >
                  Auto
                </button>
                <input
                  type="color"
                  class="color-input"
                  aria-label="Dark mode accent"
                  value={state()!.accentVariants!.dark}
                  disabled={busy()}
                  onChange={(e) => update({ accentDark: e.currentTarget.value.toLowerCase() })}
                />
              </span>
            </div>
          </Show>
        </section>

        <h2>Behaviour</h2>
        <section class="group">
          {toggle(
            'tabBarMinimize',
            'Minimize tab bar on scroll',
            'Collapses to the selected tab while scrolling down.',
            () => !d()?.support.tabBar,
          )}
          {toggle('pressGlow', 'Press glow', 'Light follows your finger on glass controls.')}
          {toggle(
            'haptics',
            'Haptics',
            d()?.support.hapticsAndroid
              ? 'Android: system touch feedback.'
              : d()?.support.hapticsIosSwitch
                ? 'iOS: experimental — tell whether you feel it.'
                : 'Not available on this device.',
            () => !d()?.support.hapticsAndroid && !d()?.support.hapticsIosSwitch,
          )}
          {toggle(
            'dynamicType',
            'Dynamic Type',
            'Scale text with iOS Settings → Display → Text Size.',
            () => !d()?.support.dynamicType,
          )}
        </section>

        <h2>Glass</h2>
        <section class="group">
          <Segmented
            label="Glass strength"
            value={s()!.glass}
            options={GLASS_OPTIONS}
            disabled={busy()}
            onChange={(glass) => update({ glass })}
          />
          <Show when={d()?.support.reducedTransparency}>
            <p class="row-note pad">Reduce Transparency is on — glass stays opaque.</p>
          </Show>
        </section>

        <h2>Scroll edge</h2>
        <section class="group">
          <Segmented
            label="Scroll edge effect"
            value={s()!.scrollEdge}
            options={SCROLL_EDGE_OPTIONS}
            disabled={busy()}
            onChange={(scrollEdge) => update({ scrollEdge })}
          />
          <p class="row-note pad">
            Content fades out under the header and the window buttons instead of colliding with
            them, and above the floating tab bar on iPhone. Soft is the iOS default.
          </p>
        </section>

        <h2>Diagnostics</h2>
        <section class="group">
          <Row title="Theme active">
            <span class={d()?.isThemeActive ? 'ok' : 'bad'}>{d()?.isThemeActive ? 'yes' : 'no'}</span>
          </Row>
          <Row title="Theme source">
            <span class="muted">{d()?.themeSource}</span>
          </Row>
          <Row title="Theme version">
            <span class={d()?.themeVersion ? 'muted' : 'bad'}>
              {d()?.themeVersion || 'old build — reinstall theme'}
            </span>
          </Row>
          <Row
            title="Add-task window styled"
            note={d()?.compose ? undefined : 'Open the add-task window once, then Refresh.'}
          >
            <span class={d()?.compose ? (d()!.compose!.themeApplied ? 'ok' : 'bad') : 'muted'}>
              {d()?.compose ? (d()!.compose!.themeApplied ? 'yes' : 'no') : '—'}
            </span>
          </Row>
          <Row title="Platform">
            <span class="muted">
              {d()?.bodyClasses.filter((c) => /^is(IOS|IPad|NativeMobile|Electron|Web|Mac)$/.test(c)).join(' ') || '—'}
            </span>
          </Row>
          <Row title="Dynamic Type body size">
            <span class="muted">{d()?.dynamicTypeBodyPx ? `${d()!.dynamicTypeBodyPx}px` : '—'}</span>
          </Row>
          <Row title="Bottom safe area">
            <span class="muted">{d()?.safeArea.bottomPx}</span>
          </Row>
          <For each={Object.entries(d()?.selectors ?? {})}>
            {([sel, found]) => (
              <Row title={sel}>
                <span class={found ? 'ok' : 'muted'}>{found ? 'found' : 'not on screen'}</span>
              </Row>
            )}
          </For>
          <details class="pad">
            <summary>Raw JSON (select and copy for bug reports)</summary>
            <pre>{JSON.stringify(d(), null, 2)}</pre>
          </details>
        </section>

        <div class="actions">
          <button type="button" disabled={busy()} onClick={refresh}>
            Refresh
          </button>
          <button
            type="button"
            class="destructive"
            disabled={busy()}
            onClick={() => run(send({ type: 'resetSettings' }))}
          >
            Reset to defaults
          </button>
        </div>
      </Show>
    </main>
  );
}
