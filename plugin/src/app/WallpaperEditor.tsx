import { For, Show, createEffect, createSignal, on, type JSX } from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';
import type { CustomWallpaper, PatternKind, RenderedWallpaper } from '../protocol';
import { send } from './bridge';

export const newWallpaper = (): CustomWallpaper => ({
  id: `wp-${Date.now().toString(36)}`,
  name: 'My wallpaper',
  angle: 180,
  light: ['#eef1ff', '#e6ecfb'],
  dark: ['#0b0c1a', '#05060d'],
  blobs: [
    { color: '#5856d6', x: 12, y: 8, size: 60, opacity: 0.55 },
    { color: '#00c7be', x: 92, y: 20, size: 55, opacity: 0.45 },
    { color: '#af52de', x: 70, y: 95, size: 70, opacity: 0.45 },
  ],
  pattern: 'none',
  patternOpacity: 0.08,
  patternSize: 18,
});

const PATTERNS: { value: PatternKind; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'lines', label: 'Lines' },
];

const Slider = (props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onInput: (v: number) => void;
}): JSX.Element => (
  <label class="slider">
    <span>{props.label}</span>
    <input
      type="range"
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      value={props.value}
      onInput={(e) => props.onInput(Number(e.currentTarget.value))}
    />
    <span class="slider-val">{props.value}</span>
  </label>
);

const Color = (props: { value: string; onInput: (v: string) => void; title?: string }) => (
  <input
    type="color"
    class="color-input"
    title={props.title}
    value={props.value}
    onInput={(e) => props.onInput(e.currentTarget.value.toLowerCase())}
  />
);

/** Editor with a live light/dark preview rendered by plugin.js (the single
 *  source of the CSS, so the preview is exactly what gets applied). */
export const WallpaperEditor = (props: {
  initial: CustomWallpaper;
  isNew: boolean;
  onSave: (w: CustomWallpaper) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}): JSX.Element => {
  const [w, setW] = createStore<CustomWallpaper>(structuredClone(props.initial));
  const [preview, setPreview] = createSignal<RenderedWallpaper | null>(null);
  let pending = 0;

  // Debounced re-render on any change.
  createEffect(
    on(
      () => JSON.stringify(w),
      () => {
        const ticket = ++pending;
        setTimeout(async () => {
          if (ticket !== pending) return;
          try {
            setPreview(await send<RenderedWallpaper>({ type: 'renderWallpaper', payload: unwrap(w) }));
          } catch {
            // keep the last good preview
          }
        }, 80);
      },
    ),
  );

  return (
    <section class="group editor">
      <div class="preview">
        <div class="preview-half" style={{ background: preview()?.light ?? '#eee' }}>
          <span class="preview-card light">Light</span>
        </div>
        <div class="preview-half" style={{ background: preview()?.dark ?? '#111' }}>
          <span class="preview-card dark">Dark</span>
        </div>
      </div>

      <label class="field">
        <span>Name</span>
        <input type="text" maxLength={40} value={w.name} onInput={(e) => setW('name', e.currentTarget.value)} />
      </label>

      <div class="field-row">
        <span class="field-label">Light base</span>
        <Color value={w.light[0]} onInput={(v) => setW('light', 0, v)} />
        <Color value={w.light[1]} onInput={(v) => setW('light', 1, v)} />
        <span class="field-label">Dark base</span>
        <Color value={w.dark[0]} onInput={(v) => setW('dark', 0, v)} />
        <Color value={w.dark[1]} onInput={(v) => setW('dark', 1, v)} />
      </div>
      <Slider label="Gradient angle" value={w.angle} min={0} max={360} onInput={(v) => setW('angle', v)} />

      <div class="field-row space">
        <span class="field-label">Colour blobs</span>
        <button
          type="button"
          class="link-btn"
          disabled={w.blobs.length >= 5}
          onClick={() =>
            setW('blobs', w.blobs.length, { color: '#ff9500', x: 50, y: 50, size: 50, opacity: 0.45 })
          }
        >
          + Add blob
        </button>
      </div>
      <For each={w.blobs}>
        {(b, i) => (
          <div class="blob">
            <div class="field-row space">
              <Color value={b.color} title="Blob colour" onInput={(v) => setW('blobs', i(), 'color', v)} />
              <button
                type="button"
                class="link-btn destructive"
                onClick={() => setW(produce((s) => void s.blobs.splice(i(), 1)))}
              >
                Remove
              </button>
            </div>
            <Slider label="X %" value={b.x} min={-20} max={120} onInput={(v) => setW('blobs', i(), 'x', v)} />
            <Slider label="Y %" value={b.y} min={-20} max={120} onInput={(v) => setW('blobs', i(), 'y', v)} />
            <Slider label="Size" value={b.size} min={10} max={120} onInput={(v) => setW('blobs', i(), 'size', v)} />
            <Slider
              label="Opacity"
              value={b.opacity}
              min={0}
              max={1}
              step={0.05}
              onInput={(v) => setW('blobs', i(), 'opacity', v)}
            />
          </div>
        )}
      </For>

      <div class="field-row space">
        <span class="field-label">Pattern</span>
      </div>
      <div class="segmented" role="radiogroup" aria-label="Pattern">
        <For each={PATTERNS}>
          {(p) => (
            <button
              type="button"
              role="radio"
              aria-checked={w.pattern === p.value}
              classList={{ on: w.pattern === p.value }}
              onClick={() => setW('pattern', p.value)}
            >
              {p.label}
            </button>
          )}
        </For>
      </div>
      <Show when={w.pattern !== 'none'}>
        <Slider
          label="Pattern opacity"
          value={w.patternOpacity}
          min={0}
          max={0.3}
          step={0.01}
          onInput={(v) => setW('patternOpacity', v)}
        />
        <Slider label="Pattern size" value={w.patternSize} min={6} max={64} onInput={(v) => setW('patternSize', v)} />
      </Show>

      <div class="actions">
        <Show when={!props.isNew}>
          <button type="button" class="destructive" onClick={() => props.onDelete(w.id)}>
            Delete
          </button>
        </Show>
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" class="primary" onClick={() => props.onSave(structuredClone(unwrap(w)))}>
          Save & use
        </button>
      </div>
    </section>
  );
};
