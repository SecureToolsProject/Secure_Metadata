import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const npmCommand = "npm";

export function run(command, args, options = {}) {
  const isWindowsNpm = process.platform === "win32" && command === npmCommand;
  const actualCommand = isWindowsNpm ? process.execPath : command;
  const actualArgs = isWindowsNpm ? [process.env.npm_execpath, ...args] : args;
  const result = spawnSync(actualCommand, actualArgs, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    ...options,
  });
  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }
    throw new Error(
      `${command} ${args.join(" ")} failed with ${String(result.status)}`,
    );
  }
  return (result.stdout ?? "").trim();
}

export async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}
