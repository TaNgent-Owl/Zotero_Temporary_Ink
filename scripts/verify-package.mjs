import { unzipSync, strFromU8 } from "fflate";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sourceManifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const packagePath = path.join(root, "dist", `zotero-temporary-ink-${sourceManifest.version}.xpi`);
const archive = unzipSync(new Uint8Array(await readFile(packagePath)));
const required = [
  "manifest.json",
  "bootstrap.js",
  "addon.js",
  "chrome.manifest",
  "prefs.js",
  "preferences/preferences.xhtml",
  "preferences/preferences.js",
  "locale/en-US/temporary-ink.ftl",
  "locale/zh-CN/temporary-ink.ftl",
  "assets/temporary-ink.svg",
];
for (const file of required) {
  if (!archive[file]) throw new Error(`XPI is missing ${file}`);
}
for (const file of Object.keys(archive)) {
  if (file.startsWith("src/") || file.startsWith("tests/") || file.endsWith(".ts")) {
    throw new Error(`Development source leaked into XPI: ${file}`);
  }
}
const manifest = JSON.parse(strFromU8(archive["manifest.json"]));
const zotero = manifest.applications?.zotero;
if (manifest.version !== sourceManifest.version || zotero?.id !== "temporary-ink@local") {
  throw new Error("Unexpected plugin identity or version");
}
if (zotero.strict_min_version !== "9.0" || zotero.strict_max_version !== "9.0.*") {
  throw new Error("Unexpected Zotero compatibility range");
}
const bootstrap = strFromU8(archive["bootstrap.js"]);
for (const lifecycle of ["startup", "shutdown", "install", "uninstall"]) {
  if (!bootstrap.includes(`function ${lifecycle}`)) throw new Error(`Missing ${lifecycle} lifecycle hook`);
}
const addon = strFromU8(archive["addon.js"]);
for (const forbidden of [
  "Zotero.Annotations",
  "saveFromJSON",
  "localStorage",
  "setInterval(",
  ".unregisterEventListener(",
]) {
  if (addon.includes(forbidden)) throw new Error(`Forbidden persistence/polling API in addon bundle: ${forbidden}`);
}
if (!addon.includes("renderToolbar") || !addon.includes("temporary-ink@local")) {
  throw new Error("Reader listener is not registered with the expected event and plugin ID");
}
console.log(`Verified ${packagePath} (${Object.keys(archive).length} files)`);
