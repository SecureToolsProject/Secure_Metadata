import assert from "node:assert/strict";

import { npmCommand, run } from "./shared.mjs";

assert.equal(
  run("git", ["status", "--porcelain"], { capture: true }),
  "",
  "release candidate checks require a clean worktree",
);
const commands = [
  [npmCommand, ["ci"]],
  [npmCommand, ["run", "format:check"]],
  [npmCommand, ["run", "lint"]],
  [npmCommand, ["run", "typecheck"]],
  [npmCommand, ["test"]],
  [npmCommand, ["run", "fuzz:smoke"]],
  [npmCommand, ["run", "build"]],
  [npmCommand, ["run", "browser:smoke"]],
  [npmCommand, ["run", "package:audit"]],
  [npmCommand, ["run", "license:audit"]],
  [npmCommand, ["audit", "--audit-level=high"]],
  [npmCommand, ["run", "version:check"]],
  [npmCommand, ["run", "release:repro"]],
  [npmCommand, ["run", "release:verify"]],
];
for (const [command, args] of commands) run(command, args);
console.log(JSON.stringify({ status: "passed", commands: commands.length }));
