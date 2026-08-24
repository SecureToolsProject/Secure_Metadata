# Security Model

Binary metadata parsing processes attacker-controlled structure, sizes, offsets, encodings, and nesting. The project therefore treats malformed files, parser panics, excessive allocation or traversal, and incorrect offset arithmetic as security concerns.

## Invariants

1. All binary input is untrusted.
2. All binary reads go through bounded primitives.
3. No parser may perform unchecked offset arithmetic.
4. Parser traversal must be hard bounded.
5. TIFF/IFD traversal must eventually include cycle detection.
6. Core functions must not make network requests.
7. Core functions must not access the filesystem.
8. The library must not decode image pixel payloads.
9. Unknown metadata must not be deleted by inference.
10. Privacy cleaning must preserve ICC and color data by default unless explicitly requested otherwise.
11. Cleaning should preserve unaffected bytes byte-for-byte whenever practical.
12. Cleaner output must be independently inspectable and verifiable.
13. The library must never claim that an image contains no private information merely because metadata is absent.
14. Steganography detection, malware scanning, visual redaction, and pixel-content privacy analysis are outside project scope.

## Bounded binary reads

Offsets and lengths must be non-negative safe integers. Ranges are checked with `length <= inputLength - offset`, avoiding overflow-prone addition during validation. Invalid offsets, invalid lengths, and out-of-bounds ranges throw typed library errors before `DataView` access. Signature mismatches and insufficient signature bytes return `false` rather than throwing.

Normalization does not copy whole inputs. A supplied `Uint8Array` retains its exact offset and length, so bytes elsewhere in its backing buffer are inaccessible to the reader. An `ArrayBuffer` receives a no-copy byte view. The inspector never writes through either representation.

## Hard limits

`inspectMetadata` enforces the effective `maxInputBytes` before detection and allocation-intensive parsing. Other default limits remain reserved for the parsers that will use them. The defaults are exported as `DEFAULT_PARSE_LIMITS`; they are conservative safeguards, not permanent API guarantees, and may evolve during `0.x` development.

Limits complement bounds checks; they do not replace them. Future parsers must fail safely or produce bounded diagnostics rather than crash on malformed input.

## Environment and dependencies

Core code is local-only and side-effect-free. It has no network, analytics, telemetry, filesystem, DOM, or pixel-codec behavior. The package has zero runtime dependencies. Development tools are not part of the shipped runtime.
