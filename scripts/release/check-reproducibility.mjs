import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";

import { npmCommand, run } from "./shared.mjs";

assert.equal(
  run("git", ["status", "--porcelain"], { capture: true }),
  "",
  "reproducibility checks require a clean worktree",
);
const temp = await mkdtemp(path.join(os.tmpdir(), "secure-metadata-repro-"));
const trees = [path.join(temp, "a"), path.join(temp, "b")];
try {
  for (const tree of trees) {
    run("git", ["worktree", "add", "--detach", tree, "HEAD"]);
    run(npmCommand, ["ci"], { cwd: tree });
    run(npmCommand, ["run", "release:build"], { cwd: tree });
  }
  const namesA = (await readdir(path.join(trees[0], "release"))).sort();
  const namesB = (await readdir(path.join(trees[1], "release"))).sort();
  assert.deepEqual(namesA, namesB);
  for (const name of namesA) {
    assert.deepEqual(
      await readFile(path.join(trees[0], "release", name)),
      await readFile(path.join(trees[1], "release", name)),
      `${name} is not reproducible`,
    );
  }
  await rm("release", { force: true, recursive: true });
  await cp(path.join(trees[0], "release"), "release", { recursive: true });
  console.log(JSON.stringify({ status: "passed", builds: 2, files: namesA }));
} finally {
  for (const tree of trees) {
    try {
      run("git", ["worktree", "remove", "--force", tree]);
    } catch {
      // Keep the original failure while still attempting all cleanup.
    }
  }
  run("git", ["worktree", "prune"]);
  await rm(temp, { force: true, recursive: true });
}
