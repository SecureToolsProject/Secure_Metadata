import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = path.join(root, "dist", "browser", "secure-metadata.js");
const artifact = await readFile(artifactPath);

const pageSource = await readFile(path.join(root, "tests/browser/smoke.html"));

const server = createServer((request, response) => {
  if (request.url === "/dist/browser/secure-metadata.js") {
    response.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
    });
    response.end(artifact);
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(pageSource);
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
assert.notStrictEqual(address, null);
assert.notStrictEqual(typeof address, "string");
const url = `http://127.0.0.1:${String(address.port)}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(
    () => globalThis.__secureMetadataSmoke !== undefined,
  );
  const result = await page.evaluate(() => globalThis.__secureMetadataSmoke);
  assert.deepStrictEqual(result, {
    ok: true,
    format: "jpeg",
    inspectionStatus: "container-inspected",
    output: [0xff, 0xd8, 0xff, 0xd9],
    valid: true,
  });
  console.log(
    JSON.stringify({
      status: "passed",
      browser: "chromium",
      artifact: "dist/browser/secure-metadata.js",
      bytes: artifact.byteLength,
    }),
  );
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  );
}
