/** "The user is driving the plot" flag. Raised by wheel / pointer / touch input and dropped `tailMs` after the last input (or after
 *  the pointer is released), so a range change that follows a layout pass (resize, first fit, a peer's data) is not mirrored to the sync
 *  group as if it were a gesture. */
export interface Gesture {
  readonly active: boolean;
  /** Wheel / touch input: active until `tailMs` of silence. */
  pulse(): void;
  /** Pointer down: active until `release()` (+ tail). */
  press(): void;
  release(): void;
  dispose(): void;
}

export function createGesture(
  tailMs = 300,
  schedule: (fn: () => void, ms: number) => unknown = setTimeout,
  cancel: (h: unknown) => void = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
): Gesture {
  let on = false;
  let held = false;
  let timer: unknown;
  const arm = () => {
    cancel(timer);
    timer = schedule(() => {
      if (!held) on = false;
    }, tailMs);
  };
  return {
    get active() {
      return on;
    },
    pulse() {
      on = true;
      arm();
    },
    press() {
      on = true;
      held = true;
      cancel(timer);
    },
    release() {
      held = false;
      arm();
    },
    dispose() {
      held = false;
      on = false;
      cancel(timer);
    },
  };
}
