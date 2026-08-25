import assert from "node:assert/strict";
import path from "node:path";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { npmCommand, run, sha256 } from "./shared.mjs";

const root = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const releaseDir = path.join(root, "release");

await rm(releaseDir, { force: true, recursive: true });
await mkdir(releaseDir, { recursive: true });
run(npmCommand, ["run", "build"]);

const browserName = `secure-metadata-${packageJson.version}.browser.js`;
await cp(
  path.join(root, "dist/browser/secure-metadata.js"),
  path.join(releaseDir, browserName),
);
const packJson = run(
  npmCommand,
  ["pack", "--pack-destination", releaseDir, "--json"],
  { capture: true },
);
const packed = JSON.parse(packJson);
assert.equal(packed.length, 1);
const tarballName = packed[0].filename;
const commit = run("git", ["rev-parse", "HEAD"], { capture: true });
const files = [browserName, tarballName];
const hashes = await Promise.all(
  files.map((name) => sha256(path.join(releaseDir, name))),
);
const manifest = [
  `# secure-metadata ${packageJson.version}`,
  `# commit ${commit}`,
  ...files.map((name, index) => `${hashes[index]}  ${name}`),
  "",
].join("\n");
await writeFile(path.join(releaseDir, "SHA256SUMS"), manifest, "utf8");
run(process.execPath, ["scripts/release/verify-hashes.mjs"]);

console.log(
  JSON.stringify({
    status: "passed",
    version: packageJson.version,
    commit,
    files,
  }),
);
