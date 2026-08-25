import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { sha256 } from "./shared.mjs";

const directory = path.resolve(process.argv[2] ?? "release");
const manifest = await readFile(path.join(directory, "SHA256SUMS"), "utf8");
const entries = manifest
  .split(/\r?\n/u)
  .filter((line) => line !== "" && !line.startsWith("#"));

assert.ok(
  entries.length >= 2,
  "SHA256SUMS must contain both release artifacts",
);
for (const entry of entries) {
  const match = /^([a-f0-9]{64})  ([^/\\]+)$/u.exec(entry);
  assert.ok(match, `invalid checksum line: ${entry}`);
  assert.equal(await sha256(path.join(directory, match[2])), match[1]);
}

console.log(JSON.stringify({ status: "passed", files: entries.length }));
