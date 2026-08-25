import assert from "node:assert/strict";

import fc from "fast-check";

import {
  cleanMetadata,
  inspectMetadata,
  SecureMetadataError,
  verifyMetadata,
} from "../dist/index.js";

const DEFAULT_SEED = 0x5ec00009;
const DEFAULT_RUNS = 5_000;
const DEFAULT_MAX_BYTES = 4_096;
const TARGETS = ["inspect", "clean", "verify"];

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function integerOption(name, environmentName, fallback, minimum, maximum) {
  const raw = option(name) ?? process.env[environmentName];
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer from ${String(minimum)} to ${String(maximum)}; received ${raw}.`,
    );
  }
  return value;
}

const seed = integerOption(
  "seed",
  "FUZZ_SEED",
  DEFAULT_SEED,
  -0x8000_0000,
  0x7fff_ffff,
);
const runs = integerOption("runs", "FUZZ_RUNS", DEFAULT_RUNS, 1, 1_000_000);
const maxBytes = integerOption(
  "max-bytes",
  "FUZZ_MAX_BYTES",
  DEFAULT_MAX_BYTES,
  0,
  DEFAULT_MAX_BYTES,
);
const target = option("target") ?? process.env.FUZZ_TARGET ?? "all";
const path = option("path") ?? process.env.FUZZ_PATH;
if (target !== "all" && !TARGETS.includes(target)) {
  throw new Error(
    `target must be all, ${TARGETS.join(", ")}; received ${target}.`,
  );
}

const targetArbitrary =
  target === "all" ? fc.constantFrom(...TARGETS) : fc.constant(target);
const inputArbitrary = fc.uint8Array({ maxLength: maxBytes });

function runTarget(selectedTarget, input) {
  const before = Uint8Array.from(input);

  if (selectedTarget === "inspect") {
    const first = inspectMetadata(input);
    const second = inspectMetadata(input);
    assert.deepStrictEqual(first, second);
  } else if (selectedTarget === "clean") {
    try {
      const first = cleanMetadata(input);
      const second = cleanMetadata(input);
      assert.deepStrictEqual(first.output, second.output);
      assert.ok(first.output.byteLength <= input.byteLength);
      assert.notStrictEqual(
        inspectMetadata(first.output).inspectionStatus,
        "container-partial",
      );
    } catch (error) {
      assert.ok(error instanceof SecureMetadataError);
    }
  } else {
    try {
      const result = verifyMetadata(input);
      if (result.report.metadataTruncated === true) {
        assert.notStrictEqual(result.valid, true);
      }
    } catch (error) {
      assert.ok(error instanceof SecureMetadataError);
    }
  }

  assert.deepStrictEqual(input, before);
}

const property = fc.property(
  fc.record({ target: targetArbitrary, input: inputArbitrary }),
  ({ target: selectedTarget, input }) => runTarget(selectedTarget, input),
);
const details = fc.check(property, {
  seed,
  numRuns: runs,
  ...(path === undefined || path.length === 0 ? {} : { path }),
});

if (details.failed) {
  const counterexample = details.counterexample?.[0];
  const input = counterexample?.input;
  const failure = {
    target: counterexample?.target ?? target,
    configuredTarget: target,
    seed: details.seed,
    path: details.counterexamplePath,
    run: details.numRuns,
    shrinks: details.numShrinks,
    inputHex:
      input instanceof Uint8Array
        ? Buffer.from(input).toString("hex")
        : undefined,
    error:
      details.errorInstance instanceof Error
        ? details.errorInstance.message
        : String(details.errorInstance),
  };
  console.error(JSON.stringify(failure, null, 2));
  console.error(
    `Replay with: npm run fuzz -- --seed ${String(details.seed)} --path ${details.counterexamplePath} --runs 1 --max-bytes ${String(maxBytes)} --target ${String(failure.configuredTarget)}`,
  );
  console.error(`fast-check replay path: ${details.counterexamplePath}`);
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      status: "passed",
      target,
      seed: details.seed,
      runs: details.numRuns,
      maxBytes,
    }),
  );
}
