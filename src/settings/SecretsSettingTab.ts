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
    description.textContent = "Startup checks report updates; manual checks require confirmation before installation and reload.";
    containerEl.append(description);

    // Vault Configuration
    const vaultHeading = document.createElement("h3");
    vaultHeading.textContent = "Vault";
    containerEl.append(vaultHeading);

    const vaultInfo = document.createElement("p");
    vaultInfo.innerHTML = "<strong>How it works:</strong> Your vault password is never stored. Only a random salt is saved in Obsidian's settings. When you unlock the vault, the master key is derived from your password + this salt. If you forget your password, your encrypted blocks cannot be recovered.";
    containerEl.append(vaultInfo);

    const vaultSalt = this.options.getSettings().vaultSalt;
    const saltStatus = document.createElement("p");
    saltStatus.innerHTML = `<strong>Vault salt:</strong> ${vaultSalt ? "Configured (" + vaultSalt.slice(0, 16) + "…)" : "Not configured"}`;
    containerEl.append(saltStatus);

    new Setting(containerEl)
      .setName("Session timeout")
      .setDesc("Minutes of inactivity before auto-locking the vault. 0 disables auto-lock.")
      .addDropdown((dropdown) => {
        [5, 15, 30, 60, 0].forEach((mins) => {
          dropdown.addOption(String(mins), mins === 0 ? "Never" : `${mins} minutes`);
        });
        dropdown
          .setValue(String(this.options.getSettings().sessionTimeoutMinutes ?? 15))
          .onChange(async (value) => {
            const settings = this.options.getSettings();
            await this.options.saveSettings({
              ...settings,
              sessionTimeoutMinutes: parseInt(value, 10),
            });
          });
      });

    new Setting(containerEl)
      .setName("Regenerate vault salt")
      .setDesc("WARNING: This will invalidate all existing encrypted blocks. Only use if you've never encrypted anything or have backups.")
      .addButton((button) => {
        button
          .setButtonText("Regenerate (DANGER)")
          .onClick(async () => {
            const confirmed = confirm("This will invalidate ALL existing encrypted blocks. Are you sure?");
            if (!confirmed) return;
            const { encodeBase64Url, VAULT_SALT_BYTES } = await import("../format.js");
            const newSalt = encodeBase64Url(crypto.getRandomValues(new Uint8Array(VAULT_SALT_BYTES)));
            const settings = this.options.getSettings();
            await this.options.saveSettings({
              ...settings,
              vaultSalt: newSalt,
            });
            saltStatus.innerHTML = `<strong>Vault salt:</strong> Configured (${newSalt.slice(0, 16)}…)`;
          });
      });

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
      .setDesc("Check the selected channel when Obsidian loads. Startup checks never install or reload updates.")
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
