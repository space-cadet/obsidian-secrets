import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { PluginUpdater, UpdateError, compareVersions, RELEASE_FILES } from "../dist/updater/PluginUpdater.js";

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

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

function createHost(adapter, requestUrl) {
  return { adapter, requestUrl };
}

function checksumsAsset() {
  return { name: "CHECKSUMS.txt", browser_download_url: "https://downloads.example.test/CHECKSUMS.txt" };
}

function release(tag = "v1.1.0", prerelease = false) {
  return {
    tag_name: tag,
    prerelease,
    assets: [
      ...RELEASE_FILES.map((name) => ({ name, browser_download_url: `https://downloads.example.test/${name}` })),
      checksumsAsset(),
    ],
  };
}

function mockDownloadResponse(files) {
  return async ({ url }) => {
    const filename = url.split("/").pop();
    if (filename === "CHECKSUMS.txt") {
      const lines = RELEASE_FILES.map((name) => `${sha256(files[name])}  ${name}`).join("\n");
      return { text: lines };
    }
    if (filename === "manifest.json") return jsonResponse({ id: "obsidian-secrets", version: "1.1.0" });
    return { text: files[filename] ?? `updated ${filename}` };
  };
}

test("compares stable versions and rolling channels", () => {
  assert.equal(compareVersions("1.2.0", "1.1.9") > 0, true);
  assert.equal(compareVersions("dev", "1.0.0") > 0, true);
  assert.equal(compareVersions("dev", "dev"), 0);
});

test("stable channel checks the latest release", async () => {
  const requestUrl = async ({ url }) => {
    assert.match(url, /\/releases\/latest$/u);
    return jsonResponse(release("v1.1.0"));
  };
  const updater = new PluginUpdater(createHost(createAdapter(), requestUrl), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  const result = await updater.checkForUpdate("1.0.0", "stable");
  assert.equal(result.hasUpdate, true);
  assert.equal(result.latestVersion, "1.1.0");
});

test("dev channel uses the current commit identity", async () => {
  const requestUrl = async ({ url }) => {
    if (url.includes("/releases?")) return jsonResponse([release("dev", true)]);
    if (url.includes("/commits/main")) return jsonResponse({ sha: "abcdef1234567890" });
    throw new Error(`unexpected URL ${url}`);
  };
  const updater = new PluginUpdater(createHost(createAdapter(), requestUrl), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  const current = await updater.checkForUpdate("1.0.0", "dev", "abcdef1-local-build");
  assert.equal(current.hasUpdate, false);
  assert.equal(current.commitMatch, true);
  const stale = await updater.checkForUpdate("1.0.0", "dev", "1234567-local-build");
  assert.equal(stale.hasUpdate, true);
  assert.equal(stale.commitMatch, false);
});

test("download requires direct HTTPS assets and validates plugin identity", async () => {
  const files = {
    "main.js": "updated main.js",
    "manifest.json": '{"id":"obsidian-secrets","version":"1.1.0"}',
    "styles.css": "updated styles.css",
  };
  const adapter = createAdapter();
  const updater = new PluginUpdater(createHost(adapter, mockDownloadResponse(files)), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  const tempDir = await updater.downloadUpdate(release("v1.1.0"));
  assert.equal(await adapter.exists(`${tempDir}/main.js`), true);
  await assert.rejects(() => updater.downloadUpdate({ ...release("v1.1.0"), assets: [] }), /missing a valid HTTPS asset/u);

  const badRequestUrl = async ({ url }) => {
    const filename = url.split("/").pop();
    if (filename === "manifest.json") return jsonResponse({ id: "other-plugin", version: "1.1.0" });
    if (filename === "CHECKSUMS.txt") {
      return { text: `${sha256("updated main.js")}  main.js\n${sha256('{\"id\":\"other-plugin\",\"version\":\"1.1.0\"}')}  manifest.json\n${sha256("updated styles.css")}  styles.css` };
    }
    return { text: files[filename] ?? `updated ${filename}` };
  };
  const badUpdater = new PluginUpdater(createHost(adapter, badRequestUrl), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  await assert.rejects(() => badUpdater.downloadUpdate(release("v1.1.0")), /different or invalid plugin/u);
});

test("download rejects tampered assets based on checksum mismatch", async () => {
  const files = {
    "main.js": "updated main.js",
    "manifest.json": '{"id":"obsidian-secrets","version":"1.1.0"}',
    "styles.css": "updated styles.css",
  };
  const adapter = createAdapter();
  const requestUrl = async ({ url }) => {
    const filename = url.split("/").pop();
    if (filename === "CHECKSUMS.txt") {
      return { text: `${sha256("tampered main.js")}  main.js\n${sha256(files["manifest.json"])}  manifest.json\n${sha256(files["styles.css"])}  styles.css` };
    }
    if (filename === "manifest.json") return jsonResponse({ id: "obsidian-secrets", version: "1.1.0" });
    return { text: files[filename] ?? `updated ${filename}` };
  };
  const updater = new PluginUpdater(createHost(adapter, requestUrl), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  await assert.rejects(() => updater.downloadUpdate(release("v1.1.0")), /checksum mismatch/u);
});

test("download rejects release missing checksums asset", async () => {
  const adapter = createAdapter();
  const requestUrl = async ({ url }) => {
    const filename = url.split("/").pop();
    if (filename === "manifest.json") return jsonResponse({ id: "obsidian-secrets", version: "1.1.0" });
    return { text: "updated" };
  };
  const updater = new PluginUpdater(createHost(adapter, requestUrl), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  await assert.rejects(
    () => updater.downloadUpdate({ tag_name: "v1.1.0", assets: RELEASE_FILES.map((name) => ({ name, browser_download_url: `https://downloads.example.test/${name}` })) }),
    /missing a valid CHECKSUMS.txt asset/u,
  );
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
  const updater = new PluginUpdater(createHost(adapter, async () => { throw new Error("unexpected"); }), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  adapter.failNextWrite(`${pluginDir}/manifest.json`);
  await assert.rejects(() => updater.installUpdate(`${pluginDir}/.update-tmp`), /rolled back/u);
  assert.equal(await adapter.read(`${pluginDir}/main.js`), "old main");
  assert.equal(await adapter.read(`${pluginDir}/manifest.json`), '{"id":"obsidian-secrets","version":"1.0.0"}');
  assert.equal(await adapter.read(`${pluginDir}/styles.css`), "old css");
});

test("failed downloads do not touch the live plugin files", async () => {
  const pluginDir = ".obsidian/plugins/obsidian-secrets";
  const adapter = createAdapter({ [`${pluginDir}/main.js`]: "existing" });
  const requestUrl = async ({ url }) => {
    if (url.endsWith("manifest.json")) return jsonResponse({ id: "other-plugin", version: "1.1.0" });
    if (url.endsWith("CHECKSUMS.txt")) return { text: "invalid" };
    return { text: "download" };
  };
  const updater = new PluginUpdater(createHost(adapter, requestUrl), { repository: "space-cadet/obsidian-secrets", pluginId: "obsidian-secrets" });
  await assert.rejects(() => updater.downloadUpdate(release("v1.1.0")), /different or invalid plugin/u);
  assert.equal(await adapter.read(`${pluginDir}/main.js`), "existing");
});
