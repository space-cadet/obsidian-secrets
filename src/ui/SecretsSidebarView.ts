import { ItemView, Notice, WorkspaceLeaf, MarkdownView, Modal, App } from "obsidian";
import type { PluginSettings } from "../settings.js";
import type { SessionKeyService } from "../session/SessionKeyService.js";
import type { SecurityHistoryService } from "../history/SecurityHistoryService.js";
import type { SecurityEvent } from "../history/SecurityHistoryService.js";
import { decodeBase64Url, MIN_ITERATIONS } from "../format.js";

export const VIEW_TYPE_SECRETS = "obsidian-secrets-sidebar";

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

function button(text: string, className = "", type: "button" | "submit" = "button"): HTMLButtonElement {
  const node = element("button", className);
  node.type = type;
  node.textContent = text;
  return node;
}

/* ───────────── History Modal ───────────── */

class HistoryModal extends Modal {
  constructor(
    app: App,
    private events: SecurityEvent[],
    private totalCount: number,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.className = "obsidian-secrets-history-modal";

    const title = element("h2");
    title.textContent = `Security History (${this.totalCount} events)`;
    contentEl.appendChild(title);

    if (this.events.length === 0) {
      contentEl.appendChild(paragraph("No security events recorded yet."));
      return;
    }

    const list = element("ul", "obsidian-secrets-history-list");
    for (const event of this.events) {
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
      li.textContent = event.details
        ? `${time} — ${label} (${event.details})`
        : `${time} — ${label}`;
      list.appendChild(li);
    }
    contentEl.appendChild(list);

    contentEl.appendChild(
      paragraph("History never contains passwords, plaintext, ciphertext, or key material.", "obsidian-secrets-helper")
    );
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}

/* ───────────── Sidebar View ───────────── */

export class SecretsSidebarView extends ItemView {
  private readonly sessionKeyService: SessionKeyService;
  private readonly getPluginSettings?: () => PluginSettings;
  private readonly openPluginSettings?: () => void;
  private readonly checkForUpdates?: () => Promise<void>;
  private readonly getHistoryService?: () => SecurityHistoryService;
  private readonly encryptSelection?: () => Promise<void>;
  private readonly decryptSelection?: () => Promise<void>;
  private readonly getActiveBlockCount?: () => number;
  private lockUnsubscribe?: () => void;

  constructor(
    leaf: WorkspaceLeaf,
    sessionKeyService: SessionKeyService,
    getPluginSettings?: () => PluginSettings,
    openPluginSettings?: () => void,
    checkForUpdates?: () => Promise<void>,
    getHistoryService?: () => SecurityHistoryService,
    encryptSelection?: () => Promise<void>,
    decryptSelection?: () => Promise<void>,
    getActiveBlockCount?: () => number,
  ) {
    super(leaf);
    this.sessionKeyService = sessionKeyService;
    this.getPluginSettings = getPluginSettings;
    this.openPluginSettings = openPluginSettings;
    this.checkForUpdates = checkForUpdates;
    this.getHistoryService = getHistoryService;
    this.encryptSelection = encryptSelection;
    this.decryptSelection = decryptSelection;
    this.getActiveBlockCount = getActiveBlockCount;
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
    // Re-render when active editor changes (to update block count)
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.render()));
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
    const blockCount = this.getActiveBlockCount?.() ?? 0;
    const settings = this.getPluginSettings?.();

    // ── Header with status ──
    const header = element("header", "obsidian-secrets-header");
    const title = element("div", "obsidian-secrets-title");
    title.textContent = "Obsidian Secrets";

    const status = element("span", isUnlocked ? "obsidian-secrets-status-dot unlocked" : "obsidian-secrets-status-dot");
    status.title = isUnlocked ? "Vault unlocked" : "Vault locked";
    status.setAttribute("aria-label", status.title);
    title.append(status);
    header.append(title);
    this.contentEl.append(header);

    // ── Main panel ──
    const panel = element("main", "obsidian-secrets-panel");

    if (isUnlocked) {
      this.renderUnlockedState(panel, blockCount, settings);
    } else {
      this.renderLockedState(panel, blockCount);
    }

    this.contentEl.append(panel);
  }

  /* ── Locked State ── */

  private renderLockedState(panel: HTMLElement, blockCount: number): void {
    // Lock card
    const lockCard = element("section", "obsidian-secrets-card obsidian-secrets-lock-card");
    const lockIcon = element("div", "obsidian-secrets-lock-icon");
    lockIcon.textContent = "LOCKED";
    lockIcon.setAttribute("aria-hidden", "true");
    lockCard.append(lockIcon, heading("Vault locked"));
    lockCard.append(paragraph("The encryption session is not active."));

    const info = element("div", "obsidian-secrets-info-box");
    info.innerHTML = "<strong>First time?</strong> Enter any password you choose — it becomes your vault password. <strong>Important:</strong> If you forget this password, your encrypted blocks cannot be recovered.";
    lockCard.append(info);

    // Unlock form
    const form = element("form", "obsidian-secrets-unlock-form");
    const label = element("label");
    label.textContent = "Unlock vault";
    const password = element("input");
    password.type = "password";
    password.placeholder = "Enter your vault password";
    password.autocomplete = "current-password";
    password.setAttribute("aria-label", "Unlock vault");
    const unlock = button("Unlock", "obsidian-secrets-primary-button", "submit");
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
        const success = await this.sessionKeyService.unlock(pwd, saltBytes, MIN_ITERATIONS);
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

    // Block count (visible even when locked)
    if (blockCount > 0) {
      const countCard = element("section", "obsidian-secrets-card");
      countCard.append(paragraph(`${blockCount} encrypted block(s) in current note. Unlock to interact with them.`, "obsidian-secrets-helper"));
      panel.append(countCard);
    }
  }

  /* ── Unlocked State ── */

  private renderUnlockedState(panel: HTMLElement, blockCount: number, settings?: PluginSettings): void {
    // Unlocked card with quick actions
    const unlockCard = element("section", "obsidian-secrets-card obsidian-secrets-unlock-card");
    const unlockIcon = element("div", "obsidian-secrets-lock-icon unlocked");
    unlockIcon.textContent = "UNLOCKED";
    unlockIcon.setAttribute("aria-hidden", "true");
    unlockCard.append(unlockIcon, heading("Vault unlocked"));
    unlockCard.append(paragraph("The encryption session is active."));

    // Quick actions
    const actionsDiv = element("div", "obsidian-secrets-actions");

    const encryptBtn = button("🔒 Encrypt", "obsidian-secrets-primary-button");
    encryptBtn.title = "Encrypt selected text in the editor";
    encryptBtn.addEventListener("click", () => void this.encryptSelection?.());
    actionsDiv.appendChild(encryptBtn);

    const decryptBtn = button("🔓 Decrypt", "obsidian-secrets-secondary-button");
    decryptBtn.title = "Decrypt selected encrypted block in the editor";
    decryptBtn.addEventListener("click", () => void this.decryptSelection?.());
    actionsDiv.appendChild(decryptBtn);

    unlockCard.append(actionsDiv);
    unlockCard.append(paragraph("Select text in a note, then tap a button above.", "obsidian-secrets-helper"));

    // Lock button
    const lockButton = button("Lock vault", "obsidian-secrets-secondary-button");
    lockButton.addEventListener("click", () => {
      this.sessionKeyService.lock();
      this.getHistoryService?.().record("vault_locked");
      new Notice("Vault locked.");
      this.render();
    });
    unlockCard.append(lockButton, paragraph("Click to clear all keys from memory.", "obsidian-secrets-helper"));
    panel.append(unlockCard);

    // Session info
    const infoCard = element("section", "obsidian-secrets-card");
    const timeoutText = settings?.sessionTimeoutMinutes
      ? `Auto-lock after ${settings.sessionTimeoutMinutes} minutes of inactivity.`
      : "Auto-lock is disabled.";
    infoCard.append(paragraph(`One vault password per session. ${timeoutText}`));
    panel.append(infoCard);

    // Block count
    const countCard = element("section", "obsidian-secrets-card");
    if (blockCount === 0) {
      countCard.append(paragraph("No encrypted blocks in current note."));
      const empty = element("div", "obsidian-secrets-empty-state");
      empty.textContent = "Select text and tap 'Encrypt' to create an encrypted block.";
      countCard.append(empty);
    } else {
      countCard.append(paragraph(`${blockCount} encrypted block(s) in current note.`));
    }
    panel.append(countCard);

    // Danger zone
    const dangerCard = element("section", "obsidian-secrets-card");
    dangerCard.append(heading("Danger zone", 3));
    dangerCard.append(paragraph("Change your vault password by generating a new vault salt. WARNING: All existing encrypted blocks will become undecryptable."));
    const resetBtn = button("Change vault password", "obsidian-secrets-danger-button");
    resetBtn.addEventListener("click", async () => {
      const confirmed = confirm("WARNING: This will change your vault password and INVALIDATE all existing encrypted blocks. They will become permanently undecryptable. Are you sure?");
      if (!confirmed) return;
      const doubleCheck = confirm("Double-check: ALL encrypted blocks in your vault will be LOST FOREVER. Proceed?");
      if (!doubleCheck) return;

      this.sessionKeyService.lock();

      const { encodeBase64Url, VAULT_SALT_BYTES } = await import("../format.js");
      const newSalt = encodeBase64Url(crypto.getRandomValues(new Uint8Array(VAULT_SALT_BYTES)));

      const event = new CustomEvent("obsidian-secrets:regenerate-salt", {
        detail: { newSalt },
      });
      document.dispatchEvent(event);

      this.getHistoryService?.().record("vault_locked", "password changed");
      new Notice("Vault password changed. Old encrypted blocks are now undecryptable. Unlock with your NEW password.");
      this.render();
    });
    dangerCard.append(resetBtn);
    panel.append(dangerCard);

    // Footer links
    const footer = element("footer", "obsidian-secrets-footer");

    const historyLink = element("a", "obsidian-secrets-footer-link");
    historyLink.textContent = "📜 View history";
    historyLink.href = "#";
    historyLink.addEventListener("click", (e) => {
      e.preventDefault();
      const history = this.getHistoryService?.();
      if (history) {
        new HistoryModal(this.app, history.getEvents(50), history.getEventCount()).open();
      }
    });
    footer.appendChild(historyLink);

    const settingsLink = element("a", "obsidian-secrets-footer-link");
    settingsLink.textContent = "⚙️ Settings";
    settingsLink.href = "#";
    settingsLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.openPluginSettings?.();
    });
    footer.appendChild(settingsLink);

    const updatesLink = element("a", "obsidian-secrets-footer-link");
    updatesLink.textContent = "🔄 Check updates";
    updatesLink.href = "#";
    updatesLink.addEventListener("click", (e) => {
      e.preventDefault();
      void this.checkForUpdates?.();
    });
    footer.appendChild(updatesLink);

    panel.append(footer);
  }
}
