import { Notice, Plugin, requestUrl, Modal, type App, type Editor } from "obsidian";
import { GIT_COMMIT_HASH } from "./buildInfo.js";
import { DEFAULT_SETTINGS, normalizePluginSettings, PluginSettings } from "./settings.js";
import { SecretsSettingTab } from "./settings/SecretsSettingTab.js";
import { SessionKeyService } from "./session/SessionKeyService.js";
import { SecretsSidebarView, VIEW_TYPE_SECRETS } from "./ui/SecretsSidebarView.js";
import { PluginUpdater } from "./updater/PluginUpdater.js";
import { UpdateAvailableModal } from "./updater/UpdateAvailableModal.js";
import { encodeBase64Url, VAULT_SALT_BYTES, decodeBase64Url } from "./format.js";
import { encryptBlockWithMasterKey, decryptBlockWithMasterKey, CryptoError } from "./crypto.js";

const REPOSITORY = "space-cadet/obsidian-secrets";

function randomBytes(length: number): Uint8Array {
  const result = new Uint8Array(length);
  globalThis.crypto?.getRandomValues(result);
  return result;
}

class DecryptRevealModal extends Modal {
  constructor(app: App, private plaintext: string) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const heading = document.createElement("h3");
    heading.textContent = "Decrypted Content";
    contentEl.appendChild(heading);

    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.wordBreak = "break-word";
    pre.style.maxHeight = "60vh";
    pre.style.overflow = "auto";
    pre.textContent = this.plaintext;
    contentEl.appendChild(pre);

    const buttonDiv = document.createElement("div");
    buttonDiv.style.marginTop = "1rem";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy to clipboard";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(this.plaintext).then(() => {
        new Notice("Copied to clipboard");
      }).catch(() => {
        new Notice("Failed to copy");
      });
    });
    buttonDiv.appendChild(copyBtn);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.marginLeft = "0.5rem";
    closeBtn.addEventListener("click", () => this.close());
    buttonDiv.appendChild(closeBtn);

    contentEl.appendChild(buttonDiv);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.innerHTML = "";
  }
}

export default class ObsidianSecretsPlugin extends Plugin {
  private settings: PluginSettings = { ...DEFAULT_SETTINGS };
  private updater!: PluginUpdater;
  private sessionKeyService = new SessionKeyService();

  async onload(): Promise<void> {
    this.settings = normalizePluginSettings(await this.loadData());

    // Ensure vault salt exists for session-key derivation
    if (!this.settings.vaultSalt) {
      this.settings.vaultSalt = encodeBase64Url(randomBytes(VAULT_SALT_BYTES));
      await this.saveData(this.settings);
    }

    this.sessionKeyService.setTimeout(this.settings.sessionTimeoutMinutes ?? 15);

    this.updater = new PluginUpdater(
      {
        adapter: this.app.vault.adapter,
        requestUrl,
      },
      { repository: REPOSITORY, pluginId: this.manifest.id },
    );

    this.registerView(VIEW_TYPE_SECRETS, (leaf) => new SecretsSidebarView(
      leaf,
      this.sessionKeyService,
      () => this.settings,
      () => this.openPluginSettings(),
      () => this.checkForUpdates(true),
    ));
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

    this.addCommand({
      id: "lock-vault",
      name: "Lock Obsidian Secrets vault",
      callback: () => {
        this.sessionKeyService.lock();
        new Notice("Obsidian Secrets vault locked.");
      },
    });

    this.addCommand({
      id: "encrypt-selection",
      name: "Encrypt selection",
      editorCallback: (editor: Editor) => {
        void this.encryptSelection(editor);
      },
    });

    this.addCommand({
      id: "decrypt-selection",
      name: "Decrypt selection",
      editorCallback: (editor: Editor) => {
        void this.decryptSelection(editor);
      },
    });

    if (this.settings.checkForUpdatesOnStartup) void this.checkForUpdates(false);
  }

  private async encryptSelection(editor: Editor): Promise<void> {
    if (!this.sessionKeyService.isUnlocked()) {
      new Notice("Vault is locked. Unlock it in the Obsidian Secrets sidebar first.");
      return;
    }

    const selection = editor.getSelection();
    if (!selection || selection.trim().length === 0) {
      new Notice("Select text to encrypt.");
      return;
    }

    const vaultSalt = this.settings.vaultSalt ? decodeBase64Url(this.settings.vaultSalt, "vs") : null;
    if (!vaultSalt) {
      new Notice("Vault salt is missing. Re-open the plugin settings.");
      return;
    }

    const masterKey = this.sessionKeyService.getMasterKey();
    if (!masterKey) {
      new Notice("Vault is locked.");
      return;
    }

    try {
      const marker = await encryptBlockWithMasterKey(selection, masterKey, { vaultSalt });
      editor.replaceSelection(marker);
      new Notice("Selection encrypted.");
    } catch (error) {
      new Notice(error instanceof CryptoError ? error.message : "Encryption failed.");
    }
  }

  private async decryptSelection(editor: Editor): Promise<void> {
    if (!this.sessionKeyService.isUnlocked()) {
      new Notice("Vault is locked. Unlock it in the Obsidian Secrets sidebar first.");
      return;
    }

    const selection = editor.getSelection();
    if (!selection || selection.trim().length === 0) {
      new Notice("Select an encrypted block to decrypt.");
      return;
    }

    const masterKey = this.sessionKeyService.getMasterKey();
    if (!masterKey) {
      new Notice("Vault is locked.");
      return;
    }

    try {
      const plaintext = await decryptBlockWithMasterKey(selection, masterKey);
      new DecryptRevealModal(this.app, plaintext).open();
    } catch (error) {
      new Notice(error instanceof CryptoError ? error.message : "Decryption failed.");
    }
  }

  onunload(): void {
    this.sessionKeyService.lock();
  }

  private async saveSettings(settings: PluginSettings): Promise<void> {
    const normalized = normalizePluginSettings(settings);
    await this.saveData(normalized);
    this.settings = normalized;
    this.sessionKeyService.setTimeout(normalized.sessionTimeoutMinutes ?? 15);
  }

  private async checkForUpdates(showNotice: boolean): Promise<void> {
    const result = await this.updater.checkForUpdate(this.manifest.version, this.settings.updateChannel, GIT_COMMIT_HASH);
    if (!showNotice && !result.hasUpdate) return;
    if (result.unavailable) {
      new Notice("Could not check for Obsidian Secrets updates.");
    } else if (result.hasUpdate && result.release) {
      if (!showNotice) {
        new Notice(`Obsidian Secrets update available: ${result.latestVersion} (${this.settings.updateChannel}).`);
        return;
      }
      new UpdateAvailableModal(
        this.app,
        result,
        async (release) => {
          const tempDir = await this.updater.downloadUpdate(release);
          await this.updater.installUpdate(tempDir);
        },
        () => this.reloadPlugin(),
      ).open();
    } else {
      new Notice("Obsidian Secrets is up to date.");
    }
  }

  private openPluginSettings(): void {
    this.app.setting.open();
    this.app.setting.openTabById(this.manifest.id);
  }

  private reloadPlugin(): void {
    this.app.commands.executeCommandById("app:reload");
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
