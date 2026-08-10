export interface CancellationSignal {
  readonly aborted: boolean;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: { once?: boolean },
  ): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

class InternalCancellationSignal implements CancellationSignal {
  aborted = false;
  private readonly listeners = new Set<() => void>();

  addEventListener(type: "abort", listener: () => void): void {
    if (type === "abort" && !this.aborted) this.listeners.add(listener);
  }

  removeEventListener(type: "abort", listener: () => void): void {
    if (type === "abort") this.listeners.delete(listener);
  }

  abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    for (const listener of [...this.listeners]) listener();
    this.listeners.clear();
  }
}

/** Bootstrap-safe cancellation primitive with no browser-global dependency. */
export class CancellationController {
  readonly signal = new InternalCancellationSignal();

  abort(): void {
    this.signal.abort();
  }
}
