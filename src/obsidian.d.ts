declare module "obsidian" {
  export interface VaultAdapter {
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
    write(path: string, data: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    remove(path: string): Promise<void>;
    rmdir(path: string, recursive?: boolean): Promise<void>;
  }

  export interface App {
    vault: { adapter: VaultAdapter };
    workspace: Workspace;
    setting: SettingManager;
  }

  export interface SettingManager {
    open(): void;
    openTabById(id: string): void;
  }

  export interface WorkspaceLeaf {
    setViewState(state: { type: string; active?: boolean }): Promise<void>;
  }

  export interface Workspace {
    getLeavesOfType(type: string): WorkspaceLeaf[];
    getRightLeaf(split: boolean): WorkspaceLeaf | null;
    revealLeaf(leaf: WorkspaceLeaf): Promise<void>;
  }

  export interface RequestUrlResponse {
    text: string;
  }

  export function requestUrl(request: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
  }): Promise<RequestUrlResponse>;

  export class Notice {
    constructor(message: string);
  }

  export class Plugin {
    app: App;
    manifest: { id: string; version: string };
    loadData(): Promise<unknown>;
    saveData(data: unknown): Promise<void>;
    addRibbonIcon(icon: string, title: string, callback: () => void | Promise<void>): HTMLElement;
    addCommand(command: {
      id: string;
      name: string;
      callback: () => void | Promise<void>;
    }): unknown;
    registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => ItemView): void;
    addSettingTab(settingTab: PluginSettingTab): void;
  }

  export class ItemView {
    constructor(leaf: WorkspaceLeaf);
    contentEl: HTMLElement;
    onOpen(): Promise<void>;
    onClose(): Promise<void>;
    getViewType(): string;
    getDisplayText(): string;
    getIcon(): string;
  }

  export class PluginSettingTab {
    constructor(app: App, plugin: Plugin);
    containerEl: HTMLElement;
    display(): void;
  }

  export interface DropdownComponent {
    addOption(value: string, display: string): this;
    setValue(value: string): this;
    onChange(callback: (value: string) => void | Promise<void>): this;
  }

  export interface ToggleComponent {
    setValue(value: boolean): this;
    onChange(callback: (value: boolean) => void | Promise<void>): this;
  }

  export interface ButtonComponent {
    setButtonText(text: string): this;
    setCta(): this;
    onClick(callback: () => void | Promise<void>): this;
  }

  export class Setting {
    constructor(containerEl: HTMLElement);
    setName(name: string): this;
    setDesc(description: string): this;
    addDropdown(callback: (component: DropdownComponent) => void): this;
    addToggle(callback: (component: ToggleComponent) => void): this;
    addButton(callback: (component: ButtonComponent) => void): this;
  }
}
