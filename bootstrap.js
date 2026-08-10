/* global Services, Zotero, TemporaryInk */

var temporaryInkAddon;

function install() {}

async function startup({ rootURI, version }) {
  await Zotero.initializationPromise;
  Services.scriptloader.loadSubScript(rootURI + "addon.js?v=" + encodeURIComponent(version));
  temporaryInkAddon = TemporaryInk.createAddon();
  await temporaryInkAddon.startup(rootURI);
}

async function shutdown() {
  if (temporaryInkAddon) {
    await temporaryInkAddon.shutdown();
    temporaryInkAddon = undefined;
  }
}

function uninstall() {}
