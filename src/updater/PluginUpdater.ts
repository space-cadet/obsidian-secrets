export type UpdateChannel = "stable" | "dev";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
  digest?: string;
}

export interface ReleaseInfo {
  tag_name: string;
  name?: string;
  body?: string;
  prerelease?: boolean;
  published_at?: string;
  html_url?: string;
  assets: ReleaseAsset[];
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  release: ReleaseInfo | null;
  isPrerelease: boolean;
  commitMatch?: boolean;
  unavailable?: boolean;
}

export interface UpdateRequest {
  url: string;
  method: "GET";
  headers: Record<string, string>;
}

export interface UpdateResponse {
  text: string;
}

export interface UpdateAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  rmdir?(path: string, recursive?: boolean): Promise<void>;
}

export interface UpdateHost {
  adapter: UpdateAdapter;
  requestUrl(request: UpdateRequest): Promise<UpdateResponse>;
}

export interface PluginUpdaterOptions {
  repository: string;
  pluginId: string;
}

export const RELEASE_FILES = ["main.js", "manifest.json", "styles.css"] as const;
const BACKUP_STATE_FILE = "state.json";
const GITHUB_API = "https://api.github.com/repos";

/** Compute SHA-256 hex digest of a UTF-8 string using the Web Crypto API. */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const subtle = (globalThis as unknown as { crypto?: { subtle: { digest(algorithm: string, data: ArrayBufferView): Promise<ArrayBuffer> } } }).crypto?.subtle;
  if (!subtle) throw new UpdateError("SHA-256 is unavailable in this environment");
  const hashBuffer = await subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare numeric plugin versions; rolling non-numeric channels sort newer. */
export function compareVersions(version1: string, version2: string): number {
  const clean1 = version1.replace(/^v/u, "");
  const clean2 = version2.replace(/^v/u, "");
  const isSemver1 = /^\d+(\.\d+)*$/u.test(clean1);
  const isSemver2 = /^\d+(\.\d+)*$/u.test(clean2);

  if (!isSemver1 && isSemver2) return 1;
  if (isSemver1 && !isSemver2) return -1;
  if (!isSemver1 && !isSemver2) return clean1 === clean2 ? 0 : 1;

  const parts1 = clean1.split(".").map(Number);
  const parts2 = clean2.split(".").map(Number);
  for (let index = 0; index < Math.max(parts1.length, parts2.length); index += 1) {
    const part1 = parts1[index] || 0;
    const part2 = parts2[index] || 0;
    if (part1 !== part2) return part1 - part2;
  }
  return 0;
}

function normalizeVersion(tag: string): string {
  return tag.replace(/^v/u, "");
}

function hashesMatch(localHash: string, remoteHash: string): boolean {
  const local = localHash.trim().toLowerCase();
  const remote = remoteHash.trim().toLowerCase();
  if (!local || !remote || local === "unknown" || remote === "unknown") return false;
  return local.length >= 7 && remote.length >= 7 && local.slice(0, 7) === remote.slice(0, 7);
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export class UpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateError";
  }
}

export class PluginUpdater {
  private readonly host: UpdateHost;
  private readonly pluginId: string;
  private readonly repository: string;
  private readonly pluginDir: string;

  constructor(host: UpdateHost, options: PluginUpdaterOptions) {
    this.host = host;
    this.pluginId = options.pluginId;
    this.repository = options.repository;
    this.pluginDir = `.obsidian/plugins/${options.pluginId}`;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(this.repository)) {
      throw new UpdateError("repository must use owner/name format");
    }
    if (!/^[A-Za-z0-9_.-]+$/u.test(this.pluginId)) {
      throw new UpdateError("plugin ID contains unsupported characters");
    }
  }

  private async requestJson<T>(url: string): Promise<T> {
    const response = await this.host.requestUrl({
      url,
      method: "GET",
      headers: {
        "User-Agent": `${this.pluginId}-updater`,
        Accept: "application/vnd.github+json",
      },
    });
    try {
      return JSON.parse(response.text) as T;
    } catch {
      throw new UpdateError("update service returned invalid JSON");
    }
  }

  private async fetchLatestCommitSHA(branch = "main"): Promise<string | null> {
    try {
      const data = await this.requestJson<unknown>(`${GITHUB_API}/${this.repository}/commits/${encodeURIComponent(branch)}`);
      return isPlainObject(data) && typeof data.sha === "string" ? data.sha : null;
    } catch {
      return null;
    }
  }

  private async selectRelease(channel: UpdateChannel): Promise<ReleaseInfo | null> {
    if (channel === "stable") {
      const release = await this.requestJson<unknown>(`${GITHUB_API}/${this.repository}/releases/latest`);
      return isPlainObject(release) && typeof release.tag_name === "string" && Array.isArray(release.assets)
        ? release as unknown as ReleaseInfo
        : null;
    }

    const releases = await this.requestJson<unknown>(`${GITHUB_API}/${this.repository}/releases?per_page=20`);
    if (!Array.isArray(releases)) return null;
    const candidates = releases.filter((release): release is ReleaseInfo =>
      isPlainObject(release) && typeof release.tag_name === "string" && Array.isArray(release.assets),
    );
    return candidates.find((release) => release.tag_name === "dev" && release.prerelease)
      ?? candidates.find((release) => release.prerelease)
      ?? candidates[0]
      ?? null;
  }

  /** Check GitHub for a stable release or a rolling development release. */
  async checkForUpdate(
    currentVersion: string,
    channel: UpdateChannel,
    currentCommitHash = "unknown",
  ): Promise<UpdateCheckResult> {
    try {
      const release = await this.selectRelease(channel);
      if (!release) {
        return { hasUpdate: false, currentVersion, latestVersion: currentVersion, release: null, isPrerelease: channel === "dev" };
      }

      const latestVersion = normalizeVersion(release.tag_name);
      if (channel === "dev" && currentCommitHash !== "unknown") {
        const latestCommitSHA = await this.fetchLatestCommitSHA();
        if (latestCommitSHA) {
          const commitMatch = hashesMatch(currentCommitHash, latestCommitSHA);
          return {
            hasUpdate: !commitMatch,
            currentVersion,
            latestVersion,
            release,
            isPrerelease: release.prerelease === true,
            commitMatch,
          };
        }
      }

      return {
        hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
        currentVersion,
        latestVersion,
        release,
        isPrerelease: release.prerelease === true,
        commitMatch: false,
      };
    } catch {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        release: null,
        isPrerelease: channel === "dev",
        unavailable: true,
      };
    }
  }

  private async ensureDir(path: string): Promise<void> {
    try {
      await this.host.adapter.mkdir(path);
    } catch {
      // The directory may already exist.
    }
  }

  private async removeFile(path: string): Promise<void> {
    if (await this.host.adapter.exists(path)) await this.host.adapter.remove(path);
  }

  private async removeDirectory(path: string): Promise<void> {
    if (!this.host.adapter.rmdir) return;
    try {
      await this.host.adapter.rmdir(path, true);
    } catch {
      // Temporary update cleanup is best effort.
    }
  }

  private assetFor(release: ReleaseInfo, filename: string): ReleaseAsset {
    const asset = release.assets.find((candidate) => candidate.name === filename);
    if (!asset || !isHttpsUrl(asset.browser_download_url)) {
      throw new UpdateError(`release is missing a valid HTTPS asset: ${filename}`);
    }
    return asset;
  }

  private async validateManifest(path: string, expectedVersion?: string): Promise<void> {
    let manifest: unknown;
    try {
      manifest = JSON.parse(await this.host.adapter.read(path));
    } catch {
      throw new UpdateError("downloaded manifest is invalid JSON");
    }
    if (!isPlainObject(manifest) || manifest.id !== this.pluginId || typeof manifest.version !== "string") {
      throw new UpdateError("downloaded update belongs to a different or invalid plugin");
    }
    if (expectedVersion && expectedVersion !== "dev" && normalizeVersion(manifest.version) !== expectedVersion) {
      throw new UpdateError("downloaded manifest version does not match the release");
    }
  }

  /** Verify SHA-256 checksums of downloaded files against the release checksums asset. */
  private async verifyChecksums(tempDir: string, release: ReleaseInfo): Promise<void> {
    const checksumAsset = release.assets.find(
      (a) => a.name === "CHECKSUMS.txt" || a.name === "checksums.txt",
    );
    if (!checksumAsset || !isHttpsUrl(checksumAsset.browser_download_url)) {
      throw new UpdateError("release is missing a valid CHECKSUMS.txt asset");
    }

    const response = await this.host.requestUrl({
      url: checksumAsset.browser_download_url,
      method: "GET",
      headers: { "User-Agent": `${this.pluginId}-updater` },
    });

    const checksumMap = new Map<string, string>();
    for (const line of response.text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const hash = parts[0].toLowerCase();
        const name = parts.slice(1).join(" ");
        if (/^[a-f0-9]{64}$/u.test(hash)) checksumMap.set(name, hash);
      }
    }

    for (const filename of RELEASE_FILES) {
      const expected = checksumMap.get(filename);
      if (!expected) throw new UpdateError(`CHECKSUMS.txt is missing entry for ${filename}`);

      const content = await this.host.adapter.read(`${tempDir}/${filename}`);
      const actual = await sha256(content);
      if (actual !== expected) {
        throw new UpdateError(
          `checksum mismatch for ${filename}: expected ${expected.slice(0, 16)}…, got ${actual.slice(0, 16)}…`,
        );
      }
    }
  }

  /** Download direct release assets into an isolated temporary directory. */
  async downloadUpdate(release: ReleaseInfo): Promise<string> {
    const tempDir = `${this.pluginDir}/.update-tmp-${Date.now()}`;
    await this.ensureDir(tempDir);
    try {
      for (const filename of RELEASE_FILES) {
        const asset = this.assetFor(release, filename);
        const response = await this.host.requestUrl({
          url: asset.browser_download_url,
          method: "GET",
          headers: { "User-Agent": `${this.pluginId}-updater` },
        });
        if (typeof response.text !== "string" || response.text.length === 0) {
          throw new UpdateError(`downloaded asset is empty: ${filename}`);
        }
        await this.host.adapter.write(`${tempDir}/${filename}`, response.text);
      }
      await this.validateManifest(`${tempDir}/manifest.json`, normalizeVersion(release.tag_name));
      await this.verifyChecksums(tempDir, release);
      return tempDir;
    } catch (error) {
      await this.removeDirectory(tempDir);
      if (error instanceof UpdateError) throw error;
      throw new UpdateError("update download failed");
    }
  }

  private async readBackupState(backupDir: string): Promise<string[]> {
    const statePath = `${backupDir}/${BACKUP_STATE_FILE}`;
    if (!(await this.host.adapter.exists(statePath))) return [];
    try {
      const state = JSON.parse(await this.host.adapter.read(statePath)) as { existingFiles?: unknown };
      return Array.isArray(state.existingFiles) && state.existingFiles.every((file) => typeof file === "string")
        ? state.existingFiles
        : [];
    } catch {
      return [];
    }
  }

  private async restoreFiles(backupDir: string, existingFiles: string[]): Promise<void> {
    for (const filename of RELEASE_FILES) {
      const backupPath = `${backupDir}/${filename}`;
      const destination = `${this.pluginDir}/${filename}`;
      if (existingFiles.includes(filename) && await this.host.adapter.exists(backupPath)) {
        await this.host.adapter.write(destination, await this.host.adapter.read(backupPath));
      } else {
        await this.removeFile(destination);
      }
    }
  }

  /** Install an update transactionally and restore the prior files after any partial failure. */
  async installUpdate(tempDir: string): Promise<void> {
    const backupDir = `${this.pluginDir}/.backup`;
    await this.ensureDir(backupDir);
    await this.validateManifest(`${tempDir}/manifest.json`);

    const existingFiles: string[] = [];
    for (const filename of RELEASE_FILES) {
      const currentPath = `${this.pluginDir}/${filename}`;
      const backupPath = `${backupDir}/${filename}`;
      if (await this.host.adapter.exists(currentPath)) {
        existingFiles.push(filename);
        await this.host.adapter.write(backupPath, await this.host.adapter.read(currentPath));
      } else {
        await this.removeFile(backupPath);
      }
    }
    await this.host.adapter.write(`${backupDir}/${BACKUP_STATE_FILE}`, JSON.stringify({ existingFiles }));

    try {
      for (const filename of RELEASE_FILES) {
        const source = `${tempDir}/${filename}`;
        if (!(await this.host.adapter.exists(source))) throw new UpdateError(`downloaded update is missing ${filename}`);
        await this.host.adapter.write(`${this.pluginDir}/${filename}`, await this.host.adapter.read(source));
      }
      await this.removeDirectory(tempDir);
    } catch (error) {
      try {
        await this.restoreFiles(backupDir, existingFiles);
      } catch {
        throw new UpdateError("update installation failed and automatic rollback also failed");
      }
      if (error instanceof UpdateError) throw new UpdateError(`update installation failed and was rolled back: ${error.message}`);
      throw new UpdateError("update installation failed and was rolled back");
    }
  }

  /** Restore the last installation snapshot. */
  async rollback(): Promise<void> {
    const backupDir = `${this.pluginDir}/.backup`;
    if (!(await this.host.adapter.exists(backupDir))) throw new UpdateError("no backup available for rollback");
    const existingFiles = await this.readBackupState(backupDir);
    if (existingFiles.length === 0 && !(await this.host.adapter.exists(`${backupDir}/${BACKUP_STATE_FILE}`))) {
      throw new UpdateError("backup state is unavailable");
    }
    await this.restoreFiles(backupDir, existingFiles);
  }
}
