import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type { Envelope } from "../format.js";
import { decodeBase64Url, MIN_ITERATIONS } from "../format.js";
import type { PluginSettings } from "../settings.js";
import type { SessionKeyService } from "../session/SessionKeyService.js";
import type { SecurityHistoryService } from "../history/SecurityHistoryService.js";
import { extractEncryptedBlocks, exportBlocksToBundle, serializeExportBundle } from "../export/ExportImportService.js";

export const VIEW_TYPE_SECRETS = "obsidian-secrets-sidebar";

type SidebarTab = "vault" | "blocks" | "history" | "settings";

const TABS: Array<{ id: SidebarTab; label: string }> = [
  { id: "vault", label: "Vault" },
  { id: "blocks", label: "Blocks" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function heading(text: string, level: 2 | 3 = 2): HTMLElement {
  const node = element(level === 2 ? "h2" : "h3");
  node.textContent = text;
  return node;
}

function paragraph(text: string, className = ""): HTMLParagraphElement {
  const node = element("p", className);
  node.textContent = text;
  return node;
}

function button(text: string, className = ""): HTMLButtonElement {
  const node = element("button", className);
  node.type = "button";
  node.textContent = text;
  return node;
}

function plannedPill(): HTMLSpanElement {
  const node = element("span", "obsidian-secrets-pill");
  node.textContent = "Planned";
  return node;
}

export class SecretsSidebarView extends ItemView {
  private activeTab: SidebarTab = "vault";
  private readonly sessionKeyService: SessionKeyService;
  private readonly getPluginSettings?: () => PluginSettings;
  private readonly openPluginSettings?: () => void;
  private readonly checkForUpdates?: () => Promise<void>;
  private readonly getHistoryService?: () => SecurityHistoryService;
  private readonly extractBlocks?: (content: string) => Array<{ marker: string; envelope: Envelope }>;
  private readonly writeFile?: (path: string, content: string) => Promise<void>;
  private readonly readFile?: (path: string) => Promise<string>;
  private readonly encryptSelection?: () => Promise<void>;
  private readonly decryptSelection?: () => Promise<void>;
  private lockUnsubscribe?: () => void;

  constructor(
    leaf: WorkspaceLeaf,
    sessionKeyService: SessionKeyService,
    getPluginSettings?: () => PluginSettings,
    openPluginSettings?: () => void,
    checkForUpdates?: () => Promise<void>,
    getHistoryService?: () => SecurityHistoryService,
    extractBlocks?: (content: string) => Array<{ marker: string; envelope: Envelope }>,
    writeFile?: (path: string, content: string) => Promise<void>,
    readFile?: (path: string) => Promise<string>,
    encryptSelection?: () => Promise<void>,
    decryptSelection?: () => Promise<void>,
  ) {
    super(leaf);
    this.sessionKeyService = sessionKeyService;
    this.getPluginSettings = getPluginSettings;
    this.openPluginSettings = openPluginSettings;
    this.checkForUpdates = checkForUpdates;
    this.getHistoryService = getHistoryService;
    this.extractBlocks = extractBlocks;
    this.writeFile = writeFile;
    this.readFile = readFile;
    this.encryptSelection = encryptSelection;
    this.decryptSelection = decryptSelection;
  }

  getViewType(): string {
    return VIEW_TYPE_SECRETS;
  }

  getDisplayText(): string {
    return "Obsidian Secrets";
  }

  getIcon(): string {
    return "lock-keyhole";
  }

  async onOpen(): Promise<void> {
    this.lockUnsubscribe = this.sessionKeyService.onLock(() => this.render());
    this.render();
  }

  async onClose(): Promise<void> {
    this.lockUnsubscribe?.();
    this.contentEl.replaceChildren();
  }

  private render(): void {
    this.contentEl.className = "obsidian-secrets-view";
    this.contentEl.replaceChildren();

    const isUnlocked = this.sessionKeyService.isUnlocked();

    const header = element("header", "obsidian-secrets-header");
    const title = element("div", "obsidian-secrets-title");
    title.textContent = "Obsidian Secrets";

    const status = element("span", isUnlocked ? "obsidian-secrets-status-dot unlocked" : "obsidian-secrets-status-dot");
    status.title = isUnlocked ? "Vault unlocked" : "Vault locked";
    status.setAttribute("aria-label", isUnlocked ? "Vault unlocked" : "Vault locked");
    title.append(status);
    header.append(title);

    const tabs = element("nav", "obsidian-secrets-tabs");
    tabs.setAttribute("aria-label", "Obsidian Secrets sections");
    tabs.setAttribute("role", "tablist");
    for (const tab of TABS) {
      const tabButton = button(tab.label, "obsidian-secrets-tab");
      tabButton.setAttribute("role", "tab");
      tabButton.setAttribute("aria-selected", String(this.activeTab === tab.id));
      tabButton.classList.toggle("is-active", this.activeTab === tab.id);
      tabButton.addEventListener("click", () => {
        this.activeTab = tab.id;
        this.render();
      });
      tabs.append(tabButton);
    }
    header.append(tabs);
    this.contentEl.append(header);

    const panel = element("main", "obsidian-secrets-panel");
    panel.setAttribute("role", "tabpanel");
    if (this.activeTab === "vault") this.renderVault(panel);
    if (this.activeTab === "blocks") this.renderBlocks(panel);
    if (this.activeTab === "history") this.renderHistory(panel);
    if (this.activeTab === "settings") this.renderSettings(panel);
    this.contentEl.append(panel);
  }

  private renderVault(panel: HTMLElement): void {
    const isUnlocked = this.sessionKeyService.isUnlocked();

    if (isUnlocked) {
      this.renderUnlockedVault(panel);
    } else {
      this.renderLockedVault(panel);
    }
  }

  private renderLockedVault(panel: HTMLElement): void {
    const lockCard = element("section", "obsidian-secrets-card obsidian-secrets-lock-card");
    const lockIcon = element("div", "obsidian-secrets-lock-icon");
    lockIcon.textContent = "LOCKED";
    lockIcon.setAttribute("aria-hidden", "true");
    lockCard.append(lockIcon, heading("Vault locked"));
    lockCard.append(paragraph("The encryption session is not active."));

    const info = element("div", "obsidian-secrets-info-box");
    info.innerHTML = "<strong>First time?</strong> Enter any password you choose — it becomes your vault password. There's no separate 'set password' step. <strong>Important:</strong> If you forget this password, your encrypted blocks cannot be recovered.";
    lockCard.append(info);

    const form = element("form", "obsidian-secrets-unlock-form");
    const label = element("label");
    label.textContent = "Unlock vault";
    const password = element("input");
    password.type = "password";
    password.placeholder = "Enter your vault password";
    password.autocomplete = "current-password";
    password.setAttribute("aria-label", "Unlock vault");
    const unlock = button("Unlock", "obsidian-secrets-primary-button");
    form.append(label, password, unlock);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (password.value.length === 0) {
        new Notice("Enter a password to continue.");
        return;
      }
      const pwd = password.value;
      password.value = "";

      const settings = this.getPluginSettings?.();
      const vaultSalt = settings?.vaultSalt;
      if (!vaultSalt) {
        new Notice("Vault salt not configured. Open plugin settings to initialize.");
        return;
      }

      try {
        const saltBytes = decodeBase64Url(vaultSalt, "vs");
        const iterations = settings?.sessionTimeoutMinutes ?? MIN_ITERATIONS;
        const success = await this.sessionKeyService.unlock(pwd, saltBytes, iterations);
        if (success) {
          this.getHistoryService?.().record("vault_unlocked");
          new Notice("Vault unlocked.");
          this.render();
        } else {
          new Notice("Failed to unlock vault. Check your password.");
        }
      } catch {
        new Notice("Failed to unlock vault.");
      }
    });
    lockCard.append(form, paragraph("Keys stay in memory only while unlocked.", "obsidian-secrets-helper"));
    panel.append(lockCard);

    const policy = element("section", "obsidian-secrets-card");
    const policyHeader = element("div", "obsidian-secrets-card-header");
    policyHeader.append(heading("Key policy", 3), plannedPill());
    policy.append(policyHeader, paragraph("One vault password per active session. Session expires after inactivity or explicit lock."));
    panel.append(policy);
  }

  private renderUnlockedVault(panel: HTMLElement): void {
    const unlockCard = element("section", "obsidian-secrets-card obsidian-secrets-unlock-card");
    const unlockIcon = element("div", "obsidian-secrets-lock-icon unlocked");
    unlockIcon.textContent = "UNLOCKED";
    unlockIcon.setAttribute("aria-hidden", "true");
    unlockCard.append(unlockIcon, heading("Vault unlocked"));
    unlockCard.append(paragraph("The encryption session is active."));

    // Quick actions for mobile
    const actionsDiv = element("div", "obsidian-secrets-actions");

    const encryptBtn = button("🔒 Encrypt selection", "obsidian-secrets-primary-button");
    encryptBtn.addEventListener("click", () => {
      void this.encryptSelection?.();
    });
    actionsDiv.appendChild(encryptBtn);

    const decryptBtn = button("🔓 Decrypt selection", "obsidian-secrets-secondary-button");
    decryptBtn.addEventListener("click", () => {
      void this.decryptSelection?.();
    });
    actionsDiv.appendChild(decryptBtn);

    unlockCard.append(actionsDiv);
    unlockCard.append(paragraph("Select text in a note, then tap a button above.", "obsidian-secrets-helper"));

    const lockButton = button("Lock vault", "obsidian-secrets-secondary-button");
    lockButton.addEventListener("click", () => {
      this.sessionKeyService.lock();
      this.getHistoryService?.().record("vault_locked");
      new Notice("Vault locked.");
      this.render();
    });
    unlockCard.append(lockButton, paragraph("Click to clear all keys from memory.", "obsidian-secrets-helper"));
    panel.append(unlockCard);

    const policy = element("section", "obsidian-secrets-card");
    const policyHeader = element("div", "obsidian-secrets-card-header");
    policyHeader.append(heading("Key policy", 3));
    const settings = this.getPluginSettings?.();
    const timeoutText = settings?.sessionTimeoutMinutes
      ? `Auto-lock after ${settings.sessionTimeoutMinutes} minutes of inactivity.`
      : "Auto-lock is disabled.";
    policy.append(policyHeader, paragraph(`One vault password per active session. ${timeoutText}`));
    panel.append(policy);
  }

  private renderBlocks(panel: HTMLElement): void {
    const card = element("section", "obsidian-secrets-card");
    card.append(heading("Protected blocks"));

    // Get current note content and scan for blocks
    const activeLeaf = this.app.workspace.getLeavesOfType("markdown")[0];
    const view = activeLeaf?.view;
    const editor = (view as { editor?: { getValue: () => string } } | undefined)?.editor;
    const content = editor?.getValue() ?? "";
    const blocks = this.extractBlocks ? this.extractBlocks(content) : [];

    if (blocks.length === 0) {
      card.append(paragraph("No encrypted blocks found in the current note."));
      const empty = element("div", "obsidian-secrets-empty-state");
      empty.textContent = "Select text and use the 'Encrypt selection' command to create encrypted blocks.";
      card.append(empty);
    } else {
      card.append(paragraph(`${blocks.length} encrypted block(s) in current note.`));
      const list = element("ul", "obsidian-secrets-block-list");
      for (let i = 0; i < blocks.length; i++) {
        const li = element("li");
        li.textContent = `Block ${i + 1}: ${blocks[i].marker.slice(0, 50)}…`;
        list.appendChild(li);
      }
      card.append(list);
    }

    const actions = element("div", "obsidian-secrets-actions");
    const exportButton = button("Export blocks", "obsidian-secrets-secondary-button");
    exportButton.addEventListener("click", () => {
      void this.exportBlocksFromSidebar(content);
    });
    actions.append(exportButton);
    card.append(actions, paragraph("Export will create a ciphertext-only JSON file. Keys and plaintext are never included.", "obsidian-secrets-helper"));
    panel.append(card);
  }

  private async exportBlocksFromSidebar(content: string): Promise<void> {
    if (!this.extractBlocks) return;
    const blocks = this.extractBlocks(content);
    if (blocks.length === 0) {
      new Notice("No encrypted blocks to export.");
      return;
    }
    const bundle = exportBlocksToBundle(blocks, "sidebar-export");
    const json = serializeExportBundle(bundle);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `obsidian-secrets-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.getHistoryService?.().record("blocks_exported", `count: ${blocks.length}`);
    new Notice(`Exported ${blocks.length} encrypted block(s).`);
  }

  private renderHistory(panel: HTMLElement): void {
    const card = element("section", "obsidian-secrets-card");
    const history = this.getHistoryService?.();
    const events = history?.getEvents(20) ?? [];

    if (events.length === 0) {
      card.append(heading("Security history"));
      card.append(paragraph("No security events recorded yet."));
      const empty = element("div", "obsidian-secrets-empty-state");
      empty.textContent = "Lock, unlock, encrypt, decrypt, and export events will appear here.";
      card.append(empty);
    } else {
      card.append(heading(`Security history (${history?.getEventCount() ?? 0} events)`));
      const list = element("ul", "obsidian-secrets-history-list");
      for (const event of events) {
        const li = element("li");
        const time = new Date(event.timestamp).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const labels: Record<string, string> = {
          vault_unlocked: "Vault unlocked",
          vault_locked: "Vault locked",
          vault_auto_locked: "Vault auto-locked",
          block_encrypted: "Block encrypted",
          block_decrypted: "Block decrypted",
          blocks_exported: "Blocks exported",
          blocks_imported: "Blocks imported",
          plugin_loaded: "Plugin loaded",
          plugin_unloaded: "Plugin unloaded",
        };
        const label = labels[event.type] ?? event.type;
        li.textContent = event.details ? `${time} — ${label} (${event.details})` : `${time} — ${label}`;
        list.appendChild(li);
      }
      card.append(list);
    }

    card.append(paragraph("History never contains passwords, plaintext, ciphertext, or key material.", "obsidian-secrets-helper"));
    panel.append(card);
  }

  private renderSettings(panel: HTMLElement): void {
    const card = element("section", "obsidian-secrets-card");
    const header = element("div", "obsidian-secrets-card-header");
    header.append(heading("Settings"));
    const openSettings = button("Open plugin settings", "obsidian-secrets-secondary-button");
    openSettings.addEventListener("click", () => this.openPluginSettings?.());
    header.append(openSettings);
    card.append(header);
    const updaterActions = element("div", "obsidian-secrets-actions");
    const checkUpdates = button("Check for updates", "obsidian-secrets-secondary-button");
    checkUpdates.addEventListener("click", () => void this.checkForUpdates?.());
    updaterActions.append(checkUpdates);
    card.append(updaterActions);
    card.append(this.settingRow("Encryption keys", "Choose the vault key policy and session expiry.", "Configured"));
    card.append(this.settingRow("Export and import", "Ciphertext-only block bundles.", "Active"));
    const settings = this.getPluginSettings?.();
    const channel = settings?.updateChannel === "dev" ? "Development" : "Stable";
    const startup = settings?.checkForUpdatesOnStartup ? "On" : "Off";
    card.append(this.settingRow("Updater", `Channel: ${channel}. Startup checks: ${startup}. Configure these in Obsidian Settings.`, "Configured"));
    panel.append(card);
  }

  private settingRow(title: string, description: string, state: string): HTMLDivElement {
    const row = element("div", "obsidian-secrets-setting-row");
    const copy = element("div");
    const titleNode = element("strong");
    titleNode.textContent = title;
    copy.append(titleNode, paragraph(description));
    const stateNode = element("span", "obsidian-secrets-pill");
    stateNode.textContent = state;
    row.append(copy, stateNode);
    return row;
  }
}
