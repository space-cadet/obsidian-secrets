import { execFileSync } from "node:child_process";
import esbuild from "esbuild";

let gitCommitHash = "unknown";
try {
  gitCommitHash = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  // Source archives without Git can still produce a development build.
}

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  platform: "browser",
  target: "es2018",
  sourcemap: false,
  treeShaking: true,
  define: { __GIT_COMMIT_HASH__: JSON.stringify(gitCommitHash) },
  outfile: "main.js",
  logLevel: "info",
});

console.log(`Built main.js for commit ${gitCommitHash}`);
