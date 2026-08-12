import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { PluginSettings } from "../settings.js";

export type SecretsSettingTabOptions = {
  getSettings: () => PluginSettings;
  saveSettings: (settings: PluginSettings) => Promise<void>;
  checkForUpdates: () => Promise<void>;
};

export class SecretsSettingTab extends PluginSettingTab {
  private readonly options: SecretsSettingTabOptions;

  constructor(app: App, plugin: Plugin, options: SecretsSettingTabOptions) {
    super(app, plugin);
    this.options = options;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Obsidian Secrets";
    containerEl.append(heading);

    const description = document.createElement("p");
    description.textContent = "Updater checks are explicit and never install or reload the plugin automatically.";
    containerEl.append(description);

    new Setting(containerEl)
      .setName("Update channel")
      .setDesc("Choose stable releases or the rolling development release.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("stable", "Stable")
          .addOption("dev", "Development")
          .setValue(this.options.getSettings().updateChannel)
          .onChange(async (value) => {
            const settings = this.options.getSettings();
            await this.options.saveSettings({
              ...settings,
              updateChannel: value === "dev" ? "dev" : "stable",
            });
          });
      });

    new Setting(containerEl)
      .setName("Check for updates on startup")
      .setDesc("Check the selected channel when Obsidian loads. Updates are not installed automatically.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.options.getSettings().checkForUpdatesOnStartup)
          .onChange(async (value) => {
            const settings = this.options.getSettings();
            await this.options.saveSettings({
              ...settings,
              checkForUpdatesOnStartup: value,
            });
          });
      });

    new Setting(containerEl)
      .setName("Check now")
      .setDesc("Check the currently selected release channel and show the result.")
      .addButton((button) => {
        button.setButtonText("Check for updates").setCta().onClick(() => this.options.checkForUpdates());
      });
  }
}
