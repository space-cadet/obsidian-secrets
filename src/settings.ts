import type { UpdateChannel } from "./updater/PluginUpdater.js";

export type PluginSettings = {
  updateChannel: UpdateChannel;
  checkForUpdatesOnStartup: boolean;
  vaultSalt?: string;
  sessionTimeoutMinutes?: number;
};

export const DEFAULT_SETTINGS: PluginSettings = {
  updateChannel: "stable",
  checkForUpdatesOnStartup: false,
  sessionTimeoutMinutes: 15,
};

export function normalizePluginSettings(value: unknown): PluginSettings {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_SETTINGS };
  }
  const stored = value as Record<string, unknown>;
  return {
    updateChannel: stored.updateChannel === "dev" ? "dev" : "stable",
    checkForUpdatesOnStartup: stored.checkForUpdatesOnStartup === true,
    vaultSalt: typeof stored.vaultSalt === "string" ? stored.vaultSalt : undefined,
    sessionTimeoutMinutes: typeof stored.sessionTimeoutMinutes === "number" ? stored.sessionTimeoutMinutes : 15,
  };
}
