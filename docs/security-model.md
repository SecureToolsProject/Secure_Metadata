# Security Model

Binary metadata parsing processes attacker-controlled structure, sizes, offsets, encodings, and nesting. The project therefore treats malformed files, parser panics, excessive allocation or traversal, and incorrect offset arithmetic as security concerns.

## Invariants

1. All binary input is untrusted.
2. All binary reads must eventually go through bounded primitives.
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

## Hard limits

Default limits bound input size, container counts, metadata entries, TIFF depth and entry counts, strings, future decompressed data, and diagnostics. The defaults are exported as `DEFAULT_PARSE_LIMITS`. They are conservative operational safeguards, not permanent API guarantees, and may evolve during `0.x` development.

Limits complement bounds checks; they do not replace them. Future parsers must fail safely or produce bounded diagnostics rather than crash on malformed input.

## Environment and dependencies

Core code is local-only and side-effect-free. It has no network, analytics, telemetry, filesystem, DOM, or pixel-codec behavior. The package starts with zero runtime dependencies. Development tools are not part of the shipped runtime.
