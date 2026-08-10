/* global Services, Zotero, TemporaryInk */

var temporaryInkAddon;

function install() {}

async function startup({ rootURI }) {
  await Zotero.initializationPromise;
  await Zotero.uiReadyPromise;
  Services.scriptloader.loadSubScript(rootURI + "addon.js");
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
