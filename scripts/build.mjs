import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "build");
const watch = process.argv.includes("--watch");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const copyTargets = [
  ["manifest.json", "manifest.json"],
  ["bootstrap.js", "bootstrap.js"],
  ["assets", "assets"],
  ["locale", "locale"],
  ["preferences", "preferences"],
  ["prefs.js", "prefs.js"],
];
for (const [source, destination] of copyTargets) {
  const from = path.join(root, source);
  if (!existsSync(from)) throw new Error(`Missing build input: ${source}`);
  await mkdir(path.dirname(path.join(output, destination)), { recursive: true });
  await cp(from, path.join(output, destination), { recursive: true });
}

const options = {
  entryPoints: [path.join(root, "src/addon.ts")],
  outfile: path.join(output, "addon.js"),
  bundle: true,
  format: "iife",
  globalName: "TemporaryInk",
  platform: "browser",
  target: "firefox115",
  sourcemap: watch,
  logLevel: "info",
};

if (watch) {
  const { context } = await import("esbuild");
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching Temporary Ink sources…");
}
else {
  await build(options);
}
