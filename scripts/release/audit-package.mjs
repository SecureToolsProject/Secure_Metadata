import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import { npmCommand, run } from "./shared.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(packageJson.version, "0.1.0");
assert.equal(packageJson.license, "MIT");
assert.equal(
  packageJson.repository.url,
  "git+https://github.com/SecureToolsProject/Secure_Metadata.git",
);
assert.equal(packageJson.publishConfig.access, "public");
assert.deepEqual(Object.keys(packageJson.dependencies ?? {}), []);

const expected = [
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "dist/browser/secure-metadata.js",
  "dist/browser/secure-metadata.js.map",
  "dist/index.d.ts",
  "dist/index.js",
  "dist/index.js.map",
  "package.json",
];
const dryRun = JSON.parse(
  run(npmCommand, ["pack", "--dry-run", "--json"], { capture: true }),
);
assert.deepEqual(
  dryRun[0].files.map(({ path: file }) => file).sort(),
  expected,
);

const mainSource = await readFile("dist/index.js", "utf8");
const browserSource = await readFile("dist/browser/secure-metadata.js", "utf8");
for (const [name, source] of [
  ["main", mainSource],
  ["browser", browserSource],
]) {
  assert.doesNotMatch(
    source,
    /from\s+["']node:|require\s*\(|\bfetch\s*\(/u,
    `${name} artifact has an external runtime dependency`,
  );
}

const temp = await mkdtemp(path.join(os.tmpdir(), "secure-metadata-package-"));
try {
  await writeFile(
    path.join(temp, "package.json"),
    JSON.stringify({
      name: "secure-metadata-consumer",
      private: true,
      type: "module",
    }),
  );
  const packed = JSON.parse(
    run(npmCommand, ["pack", "--pack-destination", temp, "--json"], {
      capture: true,
    }),
  );
  run(
    npmCommand,
    [
      "install",
      "--ignore-scripts",
      "--no-package-lock",
      "--no-save",
      path.join(temp, packed[0].filename),
    ],
    { cwd: temp },
  );
  const smoke = `
    const expected = ${JSON.stringify([
      "BinaryBoundsError",
      "DEFAULT_CLEANING_POLICY",
      "DEFAULT_JPEG_CLEANING_POLICY",
      "DEFAULT_JPEG_VERIFICATION_POLICY",
      "DEFAULT_PARSE_LIMITS",
      "DEFAULT_PNG_CLEANING_POLICY",
      "DEFAULT_PNG_VERIFICATION_POLICY",
      "DEFAULT_WEBP_CLEANING_POLICY",
      "DEFAULT_WEBP_VERIFICATION_POLICY",
      "IncompleteJpegError",
      "IncompletePngError",
      "IncompleteWebPError",
      "InputLimitExceededError",
      "InvalidParseLimitError",
      "SecureMetadataError",
      "UnsupportedFormatError",
      "cleanMetadata",
      "inspectMetadata",
      "verifyMetadata",
    ])};
    for (const specifier of ["secure-metadata", "secure-metadata/browser"]) {
      const api = await import(specifier);
      if (JSON.stringify(Object.keys(api).sort()) !== JSON.stringify(expected.sort())) throw new Error(specifier);
    }
  `;
  run(process.execPath, ["--input-type=module", "--eval", smoke], {
    cwd: temp,
  });
} finally {
  await rm(temp, { force: true, recursive: true });
}

console.log(
  JSON.stringify({
    status: "passed",
    files: expected.length,
    runtimeDependencies: 0,
  }),
);
