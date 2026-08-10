export type Dispose = () => void;

export interface Disposable {
  dispose(): void;
}

export class DisposableSlot<T extends Disposable> implements Disposable {
  private current: T | null = null;

  replace(next: T): void {
    if (next === this.current) return;
    const previous = this.current;
    this.current = next;
    previous?.dispose();
  }

  dispose(): void {
    const previous = this.current;
    this.current = null;
    previous?.dispose();
  }
}

export class DisposableStore {
  private disposers: Dispose[] = [];
  private disposed = false;

  add(disposer: Dispose): void {
    if (this.disposed) {
      disposer();
      return;
    }
    this.disposers.push(disposer);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const disposer of this.disposers.splice(0).reverse()) {
      try {
        disposer();
      }
      catch {
        // Cleanup must be best-effort and never break the Zotero Reader.
      }
    }
  }
}
