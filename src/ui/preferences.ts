import { PLUGIN_ID } from "../config/constants";

export async function registerPreferencePane(rootURI: string): Promise<string | null> {
  if (!Zotero.PreferencePanes) return null;
  return await Zotero.PreferencePanes.register({
    pluginID: PLUGIN_ID,
    src: `${rootURI}preferences/preferences.xhtml`,
    label: "Temporary Ink",
    image: `${rootURI}assets/temporary-ink.svg`,
    scripts: [`${rootURI}preferences/preferences.js`],
    stylesheets: [`${rootURI}preferences/preferences.css`],
  });
}

export function unregisterPreferencePane(id: string | null): void {
  if (id) Zotero.PreferencePanes?.unregister?.(id);
}
