import type { UpdateChannel } from "./updater/PluginUpdater.js";

export type PluginSettings = {
  updateChannel: UpdateChannel;
  checkForUpdatesOnStartup: boolean;
};

export const DEFAULT_SETTINGS: PluginSettings = {
  updateChannel: "stable",
  checkForUpdatesOnStartup: false,
};

export function normalizePluginSettings(value: unknown): PluginSettings {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_SETTINGS };
  }
  const stored = value as Record<string, unknown>;
  return {
    updateChannel: stored.updateChannel === "dev" ? "dev" : "stable",
    checkForUpdatesOnStartup: stored.checkForUpdatesOnStartup === true,
  };
}
