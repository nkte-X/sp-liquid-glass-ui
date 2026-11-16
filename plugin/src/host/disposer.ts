// The host clears plugin timers on unload, but DOM listeners, observers,
// injected nodes and classes survive unless removed here.

export type Dispose = () => void;

export class Disposer {
  private fns: Dispose[] = [];

  add(fn: Dispose): void {
    this.fns.push(fn);
  }

  listen<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ): void;
  listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (e: WindowEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ): void;
  listen(
    target: EventTarget,
    type: string,
    fn: (e: Event) => void,
    opts?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, fn as EventListener, opts);
    this.add(() => target.removeEventListener(type, fn as EventListener, opts));
  }

  /** Run every disposer, last registered first. Never throws. */
  run(): void {
    while (this.fns.length) {
      const fn = this.fns.pop()!;
      try {
        fn();
      } catch {
        // cleanup is best effort; one failure must not block the rest
      }
    }
  }
}

/** A Disposer that can be swapped out when a feature is toggled. */
export class FeatureSlot {
  private current: Disposer | null = null;

  /** Stop the running instance (if any), then start a new one when `on`. */
  set(on: boolean, start: (d: Disposer) => void): void {
    this.stop();
    if (!on) return;
    const d = new Disposer();
    this.current = d;
    try {
      start(d);
    } catch (e) {
      d.run();
      this.current = null;
      throw e;
    }
  }

  stop(): void {
    this.current?.run();
    this.current = null;
  }
}
