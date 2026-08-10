import { PLUGIN_NAME } from "../config/constants";

export const Logger = {
  debug(message: string): void {
    Zotero.debug(`[${PLUGIN_NAME}] ${message}`);
  },
  warn(message: string): void {
    Zotero.debug(`[${PLUGIN_NAME}] WARN: ${message}`, 2);
  },
  error(error: unknown): void {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    Zotero.debug(`[${PLUGIN_NAME}] ERROR: ${message}`, 1);
  },
};
