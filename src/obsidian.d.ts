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
    addRibbonIcon(icon: string, title: string, callback: () => void | Promise<void>): HTMLElement;
    addCommand(command: {
      id: string;
      name: string;
      callback: () => void | Promise<void>;
    }): unknown;
    registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => ItemView): void;
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
}
