import { For, type JSX } from 'solid-js';

/** iOS system colours as presets. */
export const SYSTEM_COLORS: { label: string; hex: string }[] = [
  { label: 'Blue', hex: '#007aff' },
  { label: 'Indigo', hex: '#5856d6' },
  { label: 'Purple', hex: '#af52de' },
  { label: 'Pink', hex: '#ff2d55' },
  { label: 'Red', hex: '#ff3b30' },
  { label: 'Orange', hex: '#ff9500' },
  { label: 'Yellow', hex: '#ffcc00' },
  { label: 'Green', hex: '#34c759' },
  { label: 'Teal', hex: '#30b0c7' },
  { label: 'Graphite', hex: '#8e8e93' },
];

/** Row of colour dots: "App" (= no override), system presets, custom. */
export const ColorPicker = (props: {
  label: string;
  value: string;
  disabled?: boolean;
  defaultLabel?: string;
  onChange: (hex: string) => void;
}): JSX.Element => {
  const isPreset = () => props.value === '' || SYSTEM_COLORS.some((c) => c.hex === props.value);
  return (
    <div class="colors" role="radiogroup" aria-label={props.label}>
      <button
        type="button"
        role="radio"
        aria-checked={props.value === ''}
        classList={{ dot: true, 'dot-app': true, on: props.value === '' }}
        title={props.defaultLabel ?? 'App default'}
        disabled={props.disabled}
        onClick={() => props.onChange('')}
      >
        A
      </button>
      <For each={SYSTEM_COLORS}>
        {(c) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.value === c.hex}
            aria-label={c.label}
            title={c.label}
            classList={{ dot: true, on: props.value === c.hex }}
            style={{ background: c.hex }}
            disabled={props.disabled}
            onClick={() => props.onChange(c.hex)}
          />
        )}
      </For>
      <label
        classList={{ dot: true, 'dot-custom': true, on: !isPreset() }}
        title="Custom colour"
        style={!isPreset() ? { background: props.value } : undefined}
      >
        <input
          type="color"
          value={props.value || '#007aff'}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.currentTarget.value.toLowerCase())}
        />
      </label>
    </div>
  );
};
