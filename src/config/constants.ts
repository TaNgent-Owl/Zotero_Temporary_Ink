export const PLUGIN_ID = "temporary-ink@local";
export const PLUGIN_NAME = "Temporary Ink";
export const DATA_ATTRIBUTE = "data-temporary-ink";

export type ToolMode = "off" | "pen" | "rectangle";
export type ModifierPreference = "alt" | "ctrl-alt";

export interface InkSettings {
  enabled: boolean;
  penColor: string;
  penWidth: number;
  penOpacity: number;
  fadeDelay: number;
  fadeDuration: number;
  modifier: ModifierPreference;
}

export const DEFAULT_SETTINGS: Readonly<InkSettings> = Object.freeze({
  enabled: true,
  penColor: "#FF4D4F",
  penWidth: 3,
  penOpacity: 0.85,
  fadeDelay: 300,
  fadeDuration: 500,
  modifier: "alt",
});
