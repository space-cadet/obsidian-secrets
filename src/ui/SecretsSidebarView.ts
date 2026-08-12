import { ItemView, Notice, WorkspaceLeaf } from "obsidian";

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

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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
    this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.replaceChildren();
  }

  private render(): void {
    this.contentEl.className = "obsidian-secrets-view";
    this.contentEl.replaceChildren();

    const header = element("header", "obsidian-secrets-header");
    const title = element("div", "obsidian-secrets-title");
    title.textContent = "Obsidian Secrets";
    const status = element("span", "obsidian-secrets-status-dot");
    status.title = "Vault locked";
    status.setAttribute("aria-label", "Vault locked");
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
    const lockCard = element("section", "obsidian-secrets-card obsidian-secrets-lock-card");
    const lockIcon = element("div", "obsidian-secrets-lock-icon");
    lockIcon.textContent = "LOCKED";
    lockIcon.setAttribute("aria-hidden", "true");
    lockCard.append(lockIcon, heading("Vault locked"));
    lockCard.append(paragraph("The encryption session is not active."));

    const form = element("form", "obsidian-secrets-unlock-form");
    const label = element("label");
    label.textContent = "Unlock vault";
    const password = element("input");
    password.type = "password";
    password.placeholder = "Enter vault password";
    password.autocomplete = "current-password";
    password.setAttribute("aria-label", "Unlock vault");
    const unlock = button("Unlock", "obsidian-secrets-primary-button");
    form.append(label, password, unlock);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (password.value.length === 0) {
        new Notice("Enter a password to continue.");
        return;
      }
      password.value = "";
      new Notice("Unlock workflow is not connected yet. No password was stored.");
    });
    lockCard.append(form, paragraph("Keys stay in memory only while unlocked.", "obsidian-secrets-helper"));
    panel.append(lockCard);

    const policy = element("section", "obsidian-secrets-card");
    const policyHeader = element("div", "obsidian-secrets-card-header");
    policyHeader.append(heading("Key policy", 3), plannedPill());
    policy.append(policyHeader, paragraph("One vault password per active session. Key choices will be connected after the session-key layer is implemented."));
    panel.append(policy);
  }

  private renderBlocks(panel: HTMLElement): void {
    const card = element("section", "obsidian-secrets-card");
    card.append(heading("Protected blocks"));
    card.append(paragraph("Encrypted inline blocks will appear here after editor integration."));
    const empty = element("div", "obsidian-secrets-empty-state");
    empty.textContent = "No protected blocks indexed yet.";
    card.append(empty);

    const actions = element("div", "obsidian-secrets-actions");
    const exportButton = button("Export", "obsidian-secrets-secondary-button");
    const importButton = button("Import", "obsidian-secrets-secondary-button");
    exportButton.disabled = true;
    importButton.disabled = true;
    exportButton.title = "Export will be available after block storage is implemented.";
    importButton.title = "Import will be available after block storage is implemented.";
    actions.append(exportButton, importButton);
    card.append(actions, paragraph("Export and import will move ciphertext blocks only; plaintext and keys will never be written to an export file.", "obsidian-secrets-helper"));
    panel.append(card);
  }

  private renderHistory(panel: HTMLElement): void {
    const card = element("section", "obsidian-secrets-card");
    const cardHeader = element("div", "obsidian-secrets-card-header");
    cardHeader.append(heading("Security history"), plannedPill());
    card.append(cardHeader, paragraph("No security events recorded yet."));
    const empty = element("div", "obsidian-secrets-empty-state");
    empty.textContent = "Lock, unlock, import, export, and update events will appear here.";
    card.append(empty, paragraph("History will never contain passwords, plaintext, ciphertext, or key material.", "obsidian-secrets-helper"));
    panel.append(card);
  }

  private renderSettings(panel: HTMLElement): void {
    const card = element("section", "obsidian-secrets-card");
    card.append(heading("Settings"));
    card.append(this.settingRow("Encryption keys", "Choose the vault key policy and session expiry.", "Planned"));
    card.append(this.settingRow("Export and import", "Configure portable ciphertext block bundles.", "Planned"));
    card.append(this.settingRow("Updater", "Choose stable or development releases and require confirmation before reload.", "Planned"));
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
