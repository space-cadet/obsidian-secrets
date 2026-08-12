import { Notice, Plugin, requestUrl } from "obsidian";
import { GIT_COMMIT_HASH } from "./buildInfo.js";
import { PluginUpdater } from "./updater/PluginUpdater.js";

const REPOSITORY = "space-cadet/obsidian-secrets";

export default class ObsidianSecretsPlugin extends Plugin {
  async onload(): Promise<void> {
    const updater = new PluginUpdater(
      {
        adapter: this.app.vault.adapter,
        requestUrl,
      },
      { repository: REPOSITORY, pluginId: this.manifest.id },
    );

    this.addCommand({
      id: "check-for-updates",
      name: "Check for plugin updates",
      callback: async () => {
        const result = await updater.checkForUpdate(this.manifest.version, "stable", GIT_COMMIT_HASH);
        if (result.unavailable) {
          new Notice("Could not check for Obsidian Secrets updates.");
        } else if (result.hasUpdate) {
          new Notice(`Obsidian Secrets update available: ${result.latestVersion}.`);
        } else {
          new Notice("Obsidian Secrets is up to date.");
        }
      },
    });
  }
}
