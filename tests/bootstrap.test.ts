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
});
