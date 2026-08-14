import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("bootstrap lifecycle", () => {
  it("version-busts the bundled addon script across in-process upgrades", async () => {
    const loadedURLs: string[] = [];
    const addon = { startup: vi.fn(), shutdown: vi.fn() };
    const context = {
      Zotero: { initializationPromise: Promise.resolve() },
      Services: {
        scriptloader: {
          loadSubScript(url: string) {
            loadedURLs.push(url);
            Object.assign(context, { TemporaryInk: { createAddon: () => addon } });
          },
        },
      },
    } as Record<string, unknown>;
    vm.runInNewContext(readFileSync("bootstrap.js", "utf8"), context);

    await (context.startup as (data: { rootURI: string; version: string }) => Promise<void>)({
      rootURI: "jar:file:///temporary-ink.xpi!/",
      version: "0.1.8",
    });

    expect(loadedURLs).toEqual(["jar:file:///temporary-ink.xpi!/addon.js?v=0.1.8"]);
  });

  it("logs, cleans up, and stays inert when add-on startup fails", async () => {
    const debugCalls: unknown[] = [];
    const addon = {
      startup: vi.fn(() => Promise.reject(new Error("startup boom"))),
      shutdown: vi.fn(() => Promise.resolve()),
    };
    const context = {
      Zotero: {
        initializationPromise: Promise.resolve(),
        debug(message: unknown) {
          debugCalls.push(message);
        },
      },
      Services: {
        scriptloader: {
          loadSubScript(_url: string) {
            Object.assign(context, { TemporaryInk: { createAddon: () => addon } });
          },
        },
      },
    } as Record<string, unknown>;
    vm.runInNewContext(readFileSync("bootstrap.js", "utf8"), context);

    await (context.startup as (data: { rootURI: string; version: string }) => Promise<void>)({
      rootURI: "jar:file:///temporary-ink.xpi!/",
      version: "0.1.8",
    });

    expect(addon.startup).toHaveBeenCalled();
    expect(addon.shutdown).toHaveBeenCalled();
    expect(debugCalls.some((call) => String(call).includes("startup failed"))).toBe(true);
    expect(context.temporaryInkAddon).toBeUndefined();
  });
});
