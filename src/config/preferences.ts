import {
  DEFAULT_SETTINGS,
  type InkSettings,
  type ModifierPreference,
} from "./constants";

export const PREF_KEYS = {
  enabled: "extensions.temporary-ink.enabled",
  penColor: "extensions.temporary-ink.penColor",
  penWidth: "extensions.temporary-ink.penWidth",
  penOpacity: "extensions.temporary-ink.penOpacity",
  fadeDelay: "extensions.temporary-ink.fadeDelay",
  fadeDuration: "extensions.temporary-ink.fadeDuration",
  modifier: "extensions.temporary-ink.modifier",
} as const;

function numberPreference(key: string, fallback: number, min: number, max: number): number {
  const value = Number(Zotero.Prefs.get(key, true));
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function readSettings(): InkSettings {
  const modifierValue = Zotero.Prefs.get(PREF_KEYS.modifier, true);
  const modifier: ModifierPreference = modifierValue === "ctrl-alt" ? "ctrl-alt" : "alt";
  const colorValue = Zotero.Prefs.get(PREF_KEYS.penColor, true);
  const penColor = typeof colorValue === "string" && /^#[0-9a-f]{6}$/i.test(colorValue)
    ? colorValue
    : DEFAULT_SETTINGS.penColor;

  return {
    enabled: Zotero.Prefs.get(PREF_KEYS.enabled, true) !== false,
    penColor,
    penWidth: numberPreference(PREF_KEYS.penWidth, DEFAULT_SETTINGS.penWidth, 1, 20),
    penOpacity: numberPreference(PREF_KEYS.penOpacity, DEFAULT_SETTINGS.penOpacity, 0.05, 1),
    fadeDelay: numberPreference(PREF_KEYS.fadeDelay, DEFAULT_SETTINGS.fadeDelay, 0, 10_000),
    fadeDuration: numberPreference(PREF_KEYS.fadeDuration, DEFAULT_SETTINGS.fadeDuration, 0, 10_000),
    modifier,
  };
}

export type SettingsProvider = () => InkSettings;
