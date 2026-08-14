/* global Services, Zotero, TemporaryInk */

var temporaryInkAddon;

function install() {}

async function startup({ rootURI, version }) {
  await Zotero.initializationPromise;
  Services.scriptloader.loadSubScript(rootURI + "addon.js?v=" + encodeURIComponent(version));
  temporaryInkAddon = TemporaryInk.createAddon();
  try {
    await temporaryInkAddon.startup(rootURI);
  }
  catch (error) {
    // Fail closed without breaking the Reader: log the failure, best-effort
    // clean up any partial state, and leave the add-on inert.
    var message = error && error.stack ? error.stack : String(error);
    Zotero.debug("[Temporary Ink] startup failed: " + message);
    try {
      await temporaryInkAddon.shutdown();
    }
    catch (cleanupError) {
      Zotero.debug("[Temporary Ink] cleanup after failed startup failed: " + String(cleanupError));
    }
    temporaryInkAddon = undefined;
  }
}

async function shutdown() {
  if (temporaryInkAddon) {
    await temporaryInkAddon.shutdown();
    temporaryInkAddon = undefined;
  }
}

function uninstall() {}
