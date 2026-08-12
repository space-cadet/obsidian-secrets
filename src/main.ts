import { Notice, Plugin, requestUrl } from "obsidian";
import { GIT_COMMIT_HASH } from "./buildInfo.js";
import { SecretsSidebarView, VIEW_TYPE_SECRETS } from "./ui/SecretsSidebarView.js";
import { PluginUpdater } from "./updater/PluginUpdater.js";

const REPOSITORY = "space-cadet/obsidian-secrets";

export default class ObsidianSecretsPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE_SECRETS, (leaf) => new SecretsSidebarView(leaf));
    this.addRibbonIcon("lock-keyhole", "Open Obsidian Secrets", () => this.activateSidebar());

    this.addCommand({
      id: "open-sidebar",
      name: "Open Obsidian Secrets sidebar",
      callback: () => this.activateSidebar(),
    });

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

  private async activateSidebar(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SECRETS)[0];
    const leaf = existing ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice("Could not open the Obsidian Secrets sidebar.");
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_SECRETS, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}
