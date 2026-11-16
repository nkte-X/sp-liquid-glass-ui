// iOS 26 sheet states. A half-height bottom sheet floats inset from the
// screen edges; at full height it docks to them (theme: ios-layer.css,
// "Sheet"). The app's DOM doesn't tell the two apart, so watch the sheet
// container's height and mark the full state with `lgx-sheet-full`.

import type { Disposer } from './disposer';
import { isIOS } from './env';

const CONTAINER = '.bottom-panel-sheet .mat-bottom-sheet-container';
const FULL = 'lgx-sheet-full';
/** Within this many px of the viewport height counts as full. */
const SLACK = 48;

export const startSheetState = (d: Disposer): void => {
  if (!isIOS()) return;
  const seen = new WeakSet<Element>();
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const full = e.target.getBoundingClientRect().height >= window.innerHeight - SLACK;
      e.target.classList.toggle(FULL, full);
    }
  });
  const scan = (): void => {
    for (const el of document.querySelectorAll(CONTAINER)) {
      if (seen.has(el)) continue;
      seen.add(el);
      ro.observe(el);
    }
  };
  scan();
  const overlay = document.querySelector('.cdk-overlay-container') ?? document.body;
  const mo = new MutationObserver(scan);
  mo.observe(overlay, { childList: true, subtree: true });
  d.add(() => {
    mo.disconnect();
    ro.disconnect();
    for (const el of document.querySelectorAll(`.${FULL}`)) el.classList.remove(FULL);
  });
};
