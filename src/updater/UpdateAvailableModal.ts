import { App, Modal, Notice, Setting } from "obsidian";
import type { ReleaseInfo, UpdateCheckResult } from "./PluginUpdater.js";

export class UpdateAvailableModal extends Modal {
  constructor(
    app: App,
    private readonly checkResult: UpdateCheckResult,
    private readonly onInstall: (release: ReleaseInfo) => Promise<void>,
    private readonly onReload: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "Update Available";
    contentEl.append(heading);

    const info = document.createElement("div");
    const current = document.createElement("p");
    current.textContent = `Current version: ${this.checkResult.currentVersion}`;
    const latest = document.createElement("p");
    latest.textContent = `Latest version: ${this.checkResult.latestVersion}`;
    info.append(current, latest);
    if (this.checkResult.isPrerelease) {
      const warning = document.createElement("p");
      warning.textContent = "⚠️ This is a pre-release (dev build).";
      warning.className = "updater-prerelease-warning";
      info.append(warning);
    }
    contentEl.append(info);

    if (this.checkResult.release?.body) {
      const changelogHeading = document.createElement("h3");
      changelogHeading.textContent = "Changelog";
      const changelog = document.createElement("pre");
      changelog.className = "updater-changelog";
      changelog.textContent = this.checkResult.release.body;
      contentEl.append(changelogHeading, changelog);
    }

    new Setting(contentEl)
      .addButton((button) => button
        .setButtonText("Install & Reload")
        .setCta()
        .onClick(async () => {
          button.setDisabled(true).setButtonText("Installing…");
          try {
            if (!this.checkResult.release) throw new Error("The update release is unavailable.");
            await this.onInstall(this.checkResult.release);
            this.close();
            new Notice("✅ Update installed. Reloading Obsidian…");
            this.onReload();
          } catch (error) {
            button.setButtonText("Install & Reload").setDisabled(false);
            new Notice(`❌ Update failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }))
      .addButton((button) => button.setButtonText("Skip").onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
