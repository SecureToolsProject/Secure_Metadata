import assert from "node:assert/strict";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

const allowed = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "ISC",
  "MIT",
  "MPL-2.0",
]);
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(rootPackage.license, "MIT");
assert.deepEqual(Object.keys(rootPackage.dependencies ?? {}), []);
assert.match(await readFile("LICENSE", "utf8"), /^MIT License/u);

const manifests = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === ".bin") continue;
    const child = path.join(directory, entry.name);
    if (entry.name.startsWith("@")) {
      await visit(child);
      continue;
    }
    try {
      manifests.push(
        JSON.parse(await readFile(path.join(child, "package.json"), "utf8")),
      );
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    try {
      await visit(path.join(child, "node_modules"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}
await visit("node_modules");

const unsupported = manifests.flatMap((manifest) => {
  const expression =
    typeof manifest.license === "string" ? manifest.license : "UNKNOWN";
  const alternatives = expression.replace(/[()]/gu, "").split(/\s+OR\s+/u);
  return alternatives.some((license) => allowed.has(license.trim()))
    ? []
    : [`${manifest.name}@${manifest.version}: ${expression}`];
});
assert.deepEqual(
  unsupported,
  [],
  `unsupported dependency licenses:\n${unsupported.join("\n")}`,
);

console.log(
  JSON.stringify({
    status: "passed",
    packages: manifests.length,
    runtimeDependencies: 0,
  }),
);
