export type SecurityEventType =
  | "vault_unlocked"
  | "vault_locked"
  | "vault_auto_locked"
  | "block_encrypted"
  | "block_decrypted"
  | "blocks_exported"
  | "blocks_imported"
  | "plugin_loaded"
  | "plugin_unloaded";

export type SecurityEvent = {
  id: string;
  type: SecurityEventType;
  timestamp: string; // ISO 8601
  details?: string; // non-sensitive context, e.g. "note: MyNote.md"
};

export type PersistedHistory = {
  version: 1;
  events: SecurityEvent[];
};

export class SecurityHistoryService {
  private events: SecurityEvent[] = [];
  private maxEvents = 100;
  private adapter?: { read(path: string): Promise<string>; write(path: string, data: string): Promise<void> };
  private filePath?: string;
  private dirty = false;

  /**
   * Configure persistence. Call before using record().
   */
  setPersistence(
    adapter: { read(path: string): Promise<string>; write(path: string, data: string): Promise<void> },
    filePath: string,
  ): void {
    this.adapter = adapter;
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    if (!this.adapter || !this.filePath) return;
    try {
      const data = await this.adapter.read(this.filePath);
      const parsed = JSON.parse(data) as PersistedHistory;
      if (parsed.version === 1 && Array.isArray(parsed.events)) {
        this.events = parsed.events.slice(0, this.maxEvents);
      }
    } catch {
      // File doesn't exist or is corrupt — start fresh
      this.events = [];
    }
  }

  async save(): Promise<void> {
    if (!this.adapter || !this.filePath || !this.dirty) return;
    const payload: PersistedHistory = { version: 1, events: this.events };
    await this.adapter.write(this.filePath, JSON.stringify(payload, null, 2));
    this.dirty = false;
  }

  record(type: SecurityEventType, details?: string): void {
    const event: SecurityEvent = {
      id: this.generateId(),
      type,
      timestamp: new Date().toISOString(),
      details,
    };
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
    this.dirty = true;
  }

  getEvents(limit = 50): SecurityEvent[] {
    return this.events.slice(0, limit);
  }

  getEventCount(): number {
    return this.events.length;
  }

  clear(): void {
    this.events = [];
    this.dirty = true;
  }

  private generateId(): string {
    const bytes = new Uint8Array(8);
    globalThis.crypto?.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
}

export function formatSecurityEvent(event: SecurityEvent): string {
  const time = new Date(event.timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const labels: Record<SecurityEventType, string> = {
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
  return event.details ? `${time} — ${label} (${event.details})` : `${time} — ${label}`;
}
