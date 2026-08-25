# Testing and Fuzz Readiness

The test suite uses deterministic TypeScript fixture builders for JPEG markers,
WebP RIFF chunks, PNG chunks and CRCs, and TIFF IFD structures. Fixtures stay
small and reviewable; binary files are used only when clearer than builder code.

## Test layers

```text
bounded binary unit tests
  → format fixtures and parser algorithms
  → deterministic malformed corpus
  → cross-format invariants
  → reproducible property tests
  → finite fuzz harness
```

The 67-case malformed corpus covers named generic, JPEG, WebP, PNG, and shared
TIFF corruption families. It remains the permanent regression foundation.
Property tests supplement it with generated variations, while the fuzz harness
repeatedly explores the public API. Generated iterations are not counted as
individual Vitest tests.

## Property tests

Property tests use the single dev-only `fast-check` dependency for bounded
arbitraries, deterministic seed/path replay, and automatic shrinking. They run
as part of `npm test` and can be invoked alone:

```text
npm test -- tests/property
```

Defaults are fixed and finite:

- parser/inspection properties: 64 runs each;
- cleaner/verification properties: 48 runs each;
- infrastructure smoke property: 16 runs;
- generated property input: at most 1,024 bytes;
- default seed: `0x5ec00009`.

`PROPERTY_SEED`, `PROPERTY_RUNS`, and `PROPERTY_PATH` override those settings.
For example, in PowerShell:

```powershell
$env:PROPERTY_SEED="1589641225"
$env:PROPERTY_PATH="0:0:1"
npm test -- tests/property
```

On failure, fast-check reports the seed, counterexample path, and shrunk input.
Use both seed and path to replay the minimized counterexample.

## Fuzz harness

The harness builds the package and exercises only the public
`inspectMetadata`, `cleanMetadata`, and `verifyMetadata` API targets.

```text
npm run fuzz:smoke
npm run fuzz -- --seed 9 --runs 10000 --max-bytes 4096 --target all
```

`fuzz:smoke` is the deterministic CI profile: seed `20260825`, 250 total
iterations, and a 512-byte input maximum. `fuzz` is the finite local profile:
seed `0x5ec00009`, 5,000 total iterations, and a 4,096-byte maximum. Supported
targets are `all`, `inspect`, `clean`, and `verify`. CLI options may also be set
with `FUZZ_SEED`, `FUZZ_RUNS`, `FUZZ_MAX_BYTES`, `FUZZ_TARGET`, and `FUZZ_PATH`.
The maximum permitted generated input is 4,096 bytes.

A failure prints its selected target, configured target, seed, run count,
counterexample path, shrink count, and bounded hexadecimal input. It also prints
an exact replay command. Runs are iteration-bounded, never elapsed-time or
infinite campaigns.

## Regression promotion

A generated failure is handled as follows:

```text
replay seed and path
  → understand the root cause
  → minimize with built-in shrinking
  → fix the production defect
  → promote the smallest meaningful input to a named corpus/regression test
  → rerun property and fuzz coverage
```

A fixed seed alone is not a permanent regression test. The minimal semantic case
must be persisted so later generator changes cannot hide it.

## Security limits and scope

Security tests use tiny custom input, segment, chunk, IFD entry/depth, metadata
entry, string, and diagnostic limits. `maxDecompressedBytes` remains unused
because the library performs no decompression. JPEG scan data, WebP image chunks,
and PNG IDAT remain opaque; generated testing does not add codecs or decoding.

Property and fuzz testing improve regression confidence but do not prove parser
correctness or security. The primary protections remain bounded readers, checked
arithmetic, explicit traversal limits, deterministic parser progress, and
fail-closed cleaning.
