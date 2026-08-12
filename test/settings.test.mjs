import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SETTINGS, normalizePluginSettings } from "../dist/settings.js";

test("settings default to stable updates without startup checks", () => {
  assert.deepEqual(normalizePluginSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizePluginSettings(null), DEFAULT_SETTINGS);
});

test("settings accept only the supported update channel and boolean startup flag", () => {
  assert.deepEqual(normalizePluginSettings({ updateChannel: "dev", checkForUpdatesOnStartup: true }), {
    updateChannel: "dev",
    checkForUpdatesOnStartup: true,
  });
  assert.deepEqual(normalizePluginSettings({ updateChannel: "preview", checkForUpdatesOnStartup: "yes" }), DEFAULT_SETTINGS);
});
