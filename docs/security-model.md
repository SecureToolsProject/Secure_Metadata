# Security Model

Binary metadata parsing processes attacker-controlled structure, sizes, offsets, encodings, and nesting. Malformed files, parser crashes, excessive allocation or traversal, and incorrect offset arithmetic are security concerns.

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

Offsets and lengths must be non-negative safe integers. Ranges use `length <= inputLength - offset`, avoiding overflow-prone addition during validation. Invalid offsets, lengths, and ranges throw typed library errors before `DataView` access. A supplied `Uint8Array` retains its exact offset and length; `ArrayBuffer` normalization creates a no-copy byte view. Inspection never writes through either representation.

## JPEG-specific properties

- Marker reads and fill-byte scans remain within the supplied input view.
- Every recorded marker, including restart markers inside scans, counts toward `maxSegments`.
- A declared segment length must be at least two and fit completely before subtraction or offset advancement.
- APP signatures must fit within their segment payload and cannot match across segment boundaries.
- Entropy-coded scan data is traversed but never decoded or copied.
- `FF 00` stuffing remains data; RST0–RST7 do not terminate a scan.
- Normal parsing resumes at non-stuffed, non-restart markers, allowing multiple SOS scans.
- EOI stops traversal; trailing bytes produce a warning rather than being parsed as JPEG.
- Malformed and truncated JPEGs return bounded structured diagnostics instead of uncontrolled native bounds exceptions.

All parser loops are iterative. Each successful branch advances its cursor or returns, which prevents non-progress cycles on hostile fill, scan, or marker data.

## Hard limits

`inspectMetadata` enforces `maxInputBytes` before parsing. JPEG traversal enforces `maxSegments`; unused limits remain reserved for their future parsers. Defaults are conservative safeguards rather than permanent `0.x` API guarantees.

## Environment and dependencies

Core code is local-only and side-effect-free. It has no network, analytics, telemetry, filesystem, DOM, or pixel-codec behavior. The package has zero runtime dependencies. Development tools are not part of the shipped runtime.
