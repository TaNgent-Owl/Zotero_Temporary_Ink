import { zipSync } from "fflate";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const buildDir = path.join(root, "build");
const distDir = path.join(root, "dist");
const manifest = JSON.parse(await readFile(path.join(buildDir, "manifest.json"), "utf8"));
const files = {};

async function collect(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const diskPath = path.join(directory, entry.name);
    const archivePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await collect(diskPath, archivePath);
    else files[archivePath] = new Uint8Array(await readFile(diskPath));
  }
}

await collect(buildDir);
await mkdir(distDir, { recursive: true });
const output = path.join(distDir, `zotero-temporary-ink-${manifest.version}.xpi`);
await writeFile(output, zipSync(files, { level: 9 }));
console.log(output);
