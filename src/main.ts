import { Notice, Plugin, requestUrl } from "obsidian";
import { GIT_COMMIT_HASH } from "./buildInfo.js";
import { DEFAULT_SETTINGS, normalizePluginSettings, PluginSettings } from "./settings.js";
import { SecretsSettingTab } from "./settings/SecretsSettingTab.js";
import { SecretsSidebarView, VIEW_TYPE_SECRETS } from "./ui/SecretsSidebarView.js";
import { PluginUpdater } from "./updater/PluginUpdater.js";

const REPOSITORY = "space-cadet/obsidian-secrets";

export default class ObsidianSecretsPlugin extends Plugin {
  private settings: PluginSettings = { ...DEFAULT_SETTINGS };
  private updater!: PluginUpdater;

  async onload(): Promise<void> {
    this.settings = normalizePluginSettings(await this.loadData());
    this.updater = new PluginUpdater(
      {
        adapter: this.app.vault.adapter,
        requestUrl,
      },
      { repository: REPOSITORY, pluginId: this.manifest.id },
    );

    this.registerView(VIEW_TYPE_SECRETS, (leaf) => new SecretsSidebarView(leaf, () => this.settings));
    this.addRibbonIcon("lock-keyhole", "Open Obsidian Secrets", () => this.activateSidebar());
    this.addSettingTab(new SecretsSettingTab(this.app, this, {
      getSettings: () => this.settings,
      saveSettings: (settings) => this.saveSettings(settings),
      checkForUpdates: () => this.checkForUpdates(true),
    }));

    this.addCommand({
      id: "open-sidebar",
      name: "Open Obsidian Secrets sidebar",
      callback: () => this.activateSidebar(),
    });

    this.addCommand({
      id: "check-for-updates",
      name: "Check for plugin updates",
      callback: () => this.checkForUpdates(true),
    });

    if (this.settings.checkForUpdatesOnStartup) void this.checkForUpdates(false);
  }

  private async saveSettings(settings: PluginSettings): Promise<void> {
    const normalized = normalizePluginSettings(settings);
    await this.saveData(normalized);
    this.settings = normalized;
  }

  private async checkForUpdates(showNotice: boolean): Promise<void> {
    const result = await this.updater.checkForUpdate(this.manifest.version, this.settings.updateChannel, GIT_COMMIT_HASH);
    if (!showNotice && !result.hasUpdate) return;
    if (result.unavailable) {
      new Notice("Could not check for Obsidian Secrets updates.");
    } else if (result.hasUpdate) {
      new Notice(`Obsidian Secrets update available: ${result.latestVersion} (${this.settings.updateChannel}).`);
    } else {
      new Notice("Obsidian Secrets is up to date.");
    }
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
