import assert from "node:assert/strict";
import { test } from "node:test";
import { PluginUpdater, UpdateError, compareVersions, RELEASE_FILES } from "../dist/updater/PluginUpdater.js";

let requestUrlImpl = async () => { throw new Error("unexpected request"); };

function jsonResponse(value) {
  return { text: JSON.stringify(value) };
}

function createAdapter(initialFiles = {}) {
  const files = new Map(Object.entries(initialFiles));
  let failPath = null;
  return {
    files,
    failNextWrite(path) { failPath = path; },
    async mkdir() {},
    async exists(path) { return files.has(path); },
    async read(path) {
      if (!files.has(path)) throw new Error(`missing ${path}`);
      return files.get(path);
    },
    async write(path, data) {
      if (path === failPath) {
        failPath = null;
        throw new Error("simulated write failure");
      }
      files.set(path, data);
    },
    async remove(path) { files.delete(path); },
    async rmdir(path, recursive) {
      if (!recursive) return;
      for (const key of files.keys()) if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    },
  };
}

function createHost(adapter) {
  return { adapter, requestUrl: (...args) => requestUrlImpl(...args) };
}

function release(tag = "v1.1.0", prerelease = false) {
  return {
    tag_name: tag,
    prerelease,
    assets: RELEASE_FILES.map((name) => ({ name, browser_download_url: `https://downloads.example.test/${name}` })),
  };
}

test("compares stable versions and rolling channels", () => {
  assert.equal(compareVersions("1.2.0", "1.1.9") > 0, true);
  assert.equal(compareVersions("dev", "1.0.0") > 0, true);
  assert.equal(compareVersions("dev", "dev"), 0);
});

test("stable channel checks the latest release", async () => {
  requestUrlImpl = async ({ url }) => {
    assert.match(url, /\/releases\/latest$/u);
    return jsonResponse(release("v1.1.0"));
  };
  const updater = new PluginUpdater(createHost(createAdapter()), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  const result = await updater.checkForUpdate("1.0.0", "stable");
  assert.equal(result.hasUpdate, true);
  assert.equal(result.latestVersion, "1.1.0");
});

test("dev channel uses the current commit identity", async () => {
  requestUrlImpl = async ({ url }) => {
    if (url.includes("/releases?")) return jsonResponse([release("dev", true)]);
    if (url.includes("/commits/main")) return jsonResponse({ sha: "abcdef1234567890" });
    throw new Error(`unexpected URL ${url}`);
  };
  const updater = new PluginUpdater(createHost(createAdapter()), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  const current = await updater.checkForUpdate("1.0.0", "dev", "abcdef1-local-build");
  assert.equal(current.hasUpdate, false);
  assert.equal(current.commitMatch, true);
  const stale = await updater.checkForUpdate("1.0.0", "dev", "1234567-local-build");
  assert.equal(stale.hasUpdate, true);
  assert.equal(stale.commitMatch, false);
});

test("download requires direct HTTPS assets and validates plugin identity", async () => {
  const adapter = createAdapter();
  requestUrlImpl = async ({ url }) => {
    const filename = url.split("/").pop();
    if (filename === "manifest.json") return jsonResponse({ id: "obsidian-secrets", version: "1.1.0" });
    return { text: `updated ${filename}` };
  };
  const updater = new PluginUpdater(createHost(adapter), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  const tempDir = await updater.downloadUpdate(release("v1.1.0"));
  assert.equal(await adapter.exists(`${tempDir}/main.js`), true);
  await assert.rejects(() => updater.downloadUpdate({ ...release("v1.1.0"), assets: [] }), /missing a valid HTTPS asset/u);
  requestUrlImpl = async ({ url }) => {
    const filename = url.split("/").pop();
    if (filename === "manifest.json") return jsonResponse({ id: "other-plugin", version: "1.1.0" });
    return { text: `updated ${filename}` };
  };
  await assert.rejects(() => updater.downloadUpdate(release("v1.1.0")), /different or invalid plugin/u);
});

test("partial installation restores every original file", async () => {
  const pluginDir = ".obsidian/plugins/obsidian-secrets";
  const adapter = createAdapter({
    [`${pluginDir}/main.js`]: "old main",
    [`${pluginDir}/manifest.json`]: '{"id":"obsidian-secrets","version":"1.0.0"}',
    [`${pluginDir}/styles.css`]: "old css",
    [`${pluginDir}/.update-tmp/main.js`]: "new main",
    [`${pluginDir}/.update-tmp/manifest.json`]: '{"id":"obsidian-secrets","version":"1.1.0"}',
    [`${pluginDir}/.update-tmp/styles.css`]: "new css",
  });
  const updater = new PluginUpdater(createHost(adapter), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  adapter.failNextWrite(`${pluginDir}/manifest.json`);
  await assert.rejects(() => updater.installUpdate(`${pluginDir}/.update-tmp`), /rolled back/u);
  assert.equal(await adapter.read(`${pluginDir}/main.js`), "old main");
  assert.equal(await adapter.read(`${pluginDir}/manifest.json`), '{"id":"obsidian-secrets","version":"1.0.0"}');
  assert.equal(await adapter.read(`${pluginDir}/styles.css`), "old css");
});

test("failed downloads do not touch the live plugin files", async () => {
  const pluginDir = ".obsidian/plugins/obsidian-secrets";
  const adapter = createAdapter({ [`${pluginDir}/main.js`]: "existing" });
  requestUrlImpl = async ({ url }) => {
    if (url.endsWith("manifest.json")) return jsonResponse({ id: "other-plugin", version: "1.1.0" });
    return { text: "download" };
  };
  const updater = new PluginUpdater(createHost(adapter), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  await assert.rejects(() => updater.downloadUpdate(release("v1.1.0")), /different or invalid plugin/u);
  assert.equal(await adapter.read(`${pluginDir}/main.js`), "existing");
});
