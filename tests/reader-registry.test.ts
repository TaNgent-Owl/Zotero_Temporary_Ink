import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/constants";
import type { ReaderContext } from "../src/reader/reader-adapter";
import { ReaderRegistry } from "../src/reader/reader-registry";
import type { ReaderController } from "../src/reader/reader-controller";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function context(dispose: () => void): ReaderContext {
  return { dispose } as unknown as ReaderContext;
}

describe("ReaderRegistry", () => {
  beforeEach(() => {
    Object.assign(globalThis, { Zotero: { debug() {} } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("attaches in a bootstrap scope without a global AbortController", async () => {
    vi.stubGlobal("AbortController", undefined);
    const reader = {};
    const readerContext = context(() => {});
    const adapter = { attach: async () => readerContext };
    const controller = {
      isDestroyed: false,
      init() {},
      destroy() {},
      refreshSettings() {},
    } as unknown as ReaderController;
    const registry = new ReaderRegistry(
      adapter as never,
      () => ({ ...DEFAULT_SETTINGS }),
      (() => controller) as never,
    );

    await expect(registry.ensure(reader)).resolves.toBe(controller);
    registry.destroyAll();
  });
  it("disposes a context that resolves after shutdown without creating a controller", async () => {
    const attachment = deferred<ReaderContext | null>();
    const adapter = { attach: () => attachment.promise };
    let disposed = 0;
    let factoryCalls = 0;
    const registry = new ReaderRegistry(
      adapter as never,
      () => ({ ...DEFAULT_SETTINGS }),
      (() => {
        factoryCalls++;
        throw new Error("must not create");
      }) as never,
    );
    const pending = registry.ensure({});
    registry.destroyAll();
    attachment.resolve(context(() => disposed++));

    await expect(pending).resolves.toBeNull();
    expect(disposed).toBe(1);
    expect(factoryCalls).toBe(0);
  });

  it("rolls back failed initialization and allows a later retry", async () => {
    const reader = {};
    let attached = 0;
    let disposed = 0;
    let factoryCalls = 0;
    const adapter = {
      attach: async () => {
        attached++;
        return context(() => disposed++);
      },
    };
    const registry = new ReaderRegistry(
      adapter as never,
      () => ({ ...DEFAULT_SETTINGS }),
      ((readerContext: ReaderContext, _settings: unknown, onDestroyed: (c: ReaderController) => void) => {
        factoryCalls++;
        let destroyed = false;
        const controller = {
          get isDestroyed() { return destroyed; },
          init() {
            if (factoryCalls === 1) throw new Error("init failed");
          },
          destroy() {
            if (destroyed) return;
            destroyed = true;
            readerContext.dispose();
            onDestroyed(controller as ReaderController);
          },
          refreshSettings() {},
        } as unknown as ReaderController;
        return controller;
      }) as never,
    );

    await expect(registry.ensure(reader)).resolves.toBeNull();
    const retry = await registry.ensure(reader);
    expect(retry).not.toBeNull();
    expect(attached).toBe(2);
    expect(disposed).toBe(1);
    registry.destroyAll();
    expect(disposed).toBe(2);
  });

  it("contains unexpected adapter rejection", async () => {
    const adapter = { attach: async () => { throw new Error("attach failed"); } };
    const registry = new ReaderRegistry(adapter as never, () => ({ ...DEFAULT_SETTINGS }));
    await expect(registry.ensure({})).resolves.toBeNull();
  });

  it("aborts an in-flight Reader attachment during shutdown", async () => {
    let observedSignal: AbortSignal | undefined;
    const adapter = {
      attach: async (_reader: unknown, _document: Document | undefined, signal: AbortSignal) => {
        observedSignal = signal;
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        return null;
      },
    };
    const registry = new ReaderRegistry(adapter as never, () => ({ ...DEFAULT_SETTINGS }));

    const pending = registry.ensure({});
    expect(observedSignal?.aborted).toBe(false);
    registry.destroyAll();

    await expect(pending).resolves.toBeNull();
    expect(observedSignal?.aborted).toBe(true);
  });
});
