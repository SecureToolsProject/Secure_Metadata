# Testing and Fuzz Readiness

The test suite uses deterministic TypeScript fixture builders for JPEG markers,
WebP RIFF chunks, PNG chunks and CRCs, and TIFF IFD structures. Fixtures stay
small, readable, and cheap; binary files are used only when they would be
clearer than the builder expression.

## Test layers

```text
bounded binary primitives
  → format fixtures and parser algorithms
  → deterministic malformed corpus
  → cross-format public API invariants
  → future reproducible property tests
  → future fuzz targets
```

The malformed corpus covers generic byte patterns plus representative JPEG,
WebP, PNG, and shared TIFF truncation, corrupt length, invalid offset, cycle,
and configured-limit families. Corpus assertions focus on stable contracts:
format/status, relevant diagnostic codes, deterministic results, caller-input
immutability, typed fail-closed cleaning and verification, and safe removal of
bounded malformed metadata. They intentionally avoid full-report snapshots and
timing thresholds.

Security-limit tests use tiny inputs with small custom values for input,
segment, chunk, IFD entry/depth, metadata entry, string, and diagnostic limits.
`maxDecompressedBytes` remains unused because the library performs no
decompression.

## Future property and fuzz targets

Likely targets are:

- `inspectMetadata(bytes)` through the public API;
- bounded JPEG, WebP, and PNG parser entry points in test/fuzz builds;
- the bounded TIFF parser as a test-only internal target;
- `cleanMetadata(bytes, policy)` through the public API.

Strong future properties include containment of native bounds exceptions,
deterministic inspection and cleaning, re-inspectable clean output, Privacy
Clean idempotency, input immutability, removal-only output sizing, preservation
of unknown structures, and default ICC preservation. WebP is permitted to patch
the RIFF size and applicable VP8X metadata flags.

No random fuzzing runs in normal CI, and no property/fuzz dependency is
currently installed. A future sprint can add reproducible seeded property tests
or dedicated fuzz harnesses if their coverage benefit justifies the development
dependency and CI cost. The deterministic corpus is regression coverage, not a
proof of parser correctness.
