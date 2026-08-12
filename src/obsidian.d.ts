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
    addCommand(command: {
      id: string;
      name: string;
      callback: () => void | Promise<void>;
    }): unknown;
  }
}
