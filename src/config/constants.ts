export const PLUGIN_ID = "temporary-ink@local";
export const PLUGIN_NAME = "Temporary Ink";
export const DATA_ATTRIBUTE = "data-temporary-ink";

export type ToolMode = "off" | "pen" | "rectangle";

export type ModifierOption = "ctrl" | "alt" | "ctrl-alt";

export interface InkSettings {
  enabled: boolean;
  modifier: ModifierOption;
  rectangleModifier: ModifierOption;
  penColor: string;
  penWidth: number;
  penOpacity: number;
  fadeDelay: number;
  fadeDuration: number;
}

export const DEFAULT_SETTINGS: Readonly<InkSettings> = Object.freeze({
  enabled: true,
  modifier: "ctrl",
  rectangleModifier: "ctrl",
  penColor: "#FF4D4F",
  penWidth: 3,
  penOpacity: 0.85,
  fadeDelay: 300,
  fadeDuration: 500,
});
