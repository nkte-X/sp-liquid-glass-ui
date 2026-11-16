// Records what the add-task window really looks like on this device the
// moment its input gets focus: DOM skeleton + the computed styles the theme
// is supposed to change. Lets us debug app versions whose markup differs
// from upstream master without Web Inspector. Focus-driven (one capture
// listener), no MutationObserver over the whole app.

import type { ComposeSnapshot } from '../protocol';
import type { Disposer } from './disposer';

let last: ComposeSnapshot | null = null;

export const lastComposeSnapshot = (): ComposeSnapshot | null => last;

const describe = (el: Element): string => {
  const cls = [...el.classList].filter((c) => !c.startsWith('ng-') && !c.startsWith('_')).slice(0, 5);
  return el.tagName.toLowerCase() + (cls.length ? `.${cls.join('.')}` : '');
};

const skeleton = (el: Element, depth: number, indent = ''): string[] => {
  const lines = [indent + describe(el)];
  if (depth <= 0) return lines;
  for (const child of [...el.children].slice(0, 8)) {
    if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
    lines.push(...skeleton(child, depth - 1, `${indent}  `));
  }
  return lines;
};

const styleOf = (el: Element | null): Record<string, string> | null => {
  if (!el) return null;
  const cs = getComputedStyle(el);
  const w = cs as unknown as Record<string, string>;
  return {
    el: describe(el),
    borderRadius: cs.borderRadius,
    backgroundColor: cs.backgroundColor,
    backgroundImage: cs.backgroundImage.slice(0, 80),
    backdropFilter: w.backdropFilter || w.webkitBackdropFilter || '',
    border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
    boxShadow: cs.boxShadow.slice(0, 120),
  };
};

/** --lgx-compose-radius resolved to px (it is a calc() of other tokens). */
const themeRadius = (): string => {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;border-top-left-radius:var(--lgx-compose-radius)';
  document.body.appendChild(probe);
  const r = getComputedStyle(probe).borderTopLeftRadius;
  probe.remove();
  return r;
};

const snapshot = (input: Element): void => {
  const host = input.closest('add-task-bar') ?? input.closest('[class*="add-task"]');
  const root = host ?? input.parentElement?.parentElement?.parentElement ?? input;
  const container =
    root.querySelector('.add-task-container') ??
    (input.closest('[class*="container"]') as Element | null);
  last = {
    at: new Date().toISOString(),
    host: host ? describe(host) : null,
    themeApplied: !!container && getComputedStyle(container).borderTopLeftRadius === themeRadius(),
    container: styleOf(container),
    input: styleOf(input),
    ancestors: (() => {
      const out: string[] = [];
      let el: Element | null = input;
      for (let i = 0; el && i < 8; i++, el = el.parentElement) out.push(describe(el));
      return out;
    })(),
    skeleton: skeleton(root, 4).join('\n').slice(0, 2500),
  };
};

export const startComposeProbe = (d: Disposer): void => {
  d.listen(
    document,
    'focusin',
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement)) return;
      if (!t.closest('add-task-bar, [class*="add-task"]')) return;
      // let the open animation / theme settle before reading styles
      requestAnimationFrame(() => requestAnimationFrame(() => snapshot(t)));
    },
    { capture: true, passive: true },
  );
};
