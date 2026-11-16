// Haptic ticks for taps on tabs, the add button and done toggles.
//
// - Android app: the app's own bridge `window.SUPAndroid.performHapticFeedback`
//   (respects the system touch-feedback setting). The app already buzzes on
//   done-toggle there, so done-toggle is skipped on Android.
// - iOS: WebKit has no vibration API and the app has no haptics bridge. iOS 18+
//   plays the system haptic when a `<input type="checkbox" switch>` is toggled
//   through its <label> during a user gesture. Whether that also fires inside
//   the app's WKWebView must be checked on device — hence "experimental".
//
// Only ever called from a local pointer gesture, never from hooks or state
// changes (remote sync must not buzz the device).

import type { Disposer } from './disposer';
import { SEL, isAndroidApp, isIOS } from './env';

type AndroidType = 'confirm' | 'threshold' | 'longPress';

const android = (type: AndroidType): void => {
  try {
    (
      window as unknown as { SUPAndroid?: { performHapticFeedback?(t: AndroidType): void } }
    ).SUPAndroid?.performHapticFeedback?.(type);
  } catch {
    // cosmetic only
  }
};

/** Whether the iOS switch trick will be attempted. Whether it actually
 *  produces a haptic in the app's WebView can only be felt, not detected. */
export const attemptsIosSwitchHaptics = (): boolean => !isAndroidApp() && isIOS();

export const startHaptics = (d: Disposer): void => {
  const onAndroid = isAndroidApp();
  const onIOS = !onAndroid && isIOS();
  if (!onAndroid && !onIOS) return;

  let label: HTMLLabelElement | null = null;
  if (onIOS) {
    label = document.createElement('label');
    label.id = 'lgx-haptic';
    label.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    d.add(() => label?.remove());
  }

  const tick = (kind: 'tab' | 'add' | 'done'): void => {
    if (onAndroid) {
      if (kind === 'done') return; // the app already does this
      android(kind === 'add' ? 'confirm' : 'threshold');
    } else if (label) {
      label.click();
    }
  };

  d.listen(
    document,
    'click',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(SEL.addButton)) tick('add');
      else if (t.closest(SEL.tabButton)) tick('tab');
      else if (t.closest(SEL.doneToggle)) tick('done');
    },
    { capture: true, passive: true },
  );
};
