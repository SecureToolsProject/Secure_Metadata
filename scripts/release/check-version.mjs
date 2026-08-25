import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));

assert.equal(packageJson.version, "0.1.0");
assert.equal(lock.version, packageJson.version);
assert.equal(lock.packages[""].version, packageJson.version);

const tagIndex = process.argv.indexOf("--tag");
if (tagIndex !== -1) {
  assert.equal(process.argv[tagIndex + 1], `v${packageJson.version}`);
}

console.log(JSON.stringify({ status: "passed", version: packageJson.version }));
