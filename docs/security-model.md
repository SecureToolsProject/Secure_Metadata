# Security Model

Binary metadata parsing processes attacker-controlled structures, sizes, offsets, encodings, and nesting. Malformed files, parser crashes, excessive allocation or traversal, and incorrect offset arithmetic are security concerns.

## Invariants

1. All binary input is untrusted and all reads use bounded primitives.
2. Parsers perform no unchecked offset arithmetic or unbounded recursion.
3. Parser traversal and attacker-controlled counts are hard bounded.
4. Core functions make no network requests and access no filesystem or DOM APIs.
5. Image pixel payloads are never decoded.
6. Unknown metadata is not deleted or assigned speculative meaning.
7. ICC and color data will be preserved by default during future cleaning.
8. Cleaner output must eventually be independently inspected and verified.
9. Metadata absence never proves an image contains no private information.
10. Steganography detection, malware scanning, visual redaction, and pixel privacy analysis are outside scope.

## Bounded binary and JPEG properties

Offsets and lengths must be non-negative safe integers. Ranges use subtraction-based capacity checks before access. JPEG declared segment lengths must fit completely; marker and scan loops always advance or return. `FF 00`, restart markers, multiple scans, EOI, and marker limits are handled without entropy decoding or payload copies.

## TIFF-specific properties

- Byte order is accepted only from explicit `II` or `MM`; magic 42 is validated before traversal.
- The decoder receives a bounded TIFF-only view. All TIFF and IFD offsets are relative to its header, never to JPEG or APP1.
- A full IFD table range, including the next-IFD pointer, is validated before entry iteration.
- `count × typeSize` uses checked safe-integer multiplication before range calculations.
- Inline values use their actual byte region and endian order; offset values must fit completely within the TIFF view.
- `maxIfdEntries` bounds per-IFD work, `maxIfdDepth` bounds linked depth, and `maxMetadataEntries` caps total entry and queue work.
- A visited-offset set rejects cyclic and repeated IFD references.
- Unsupported types and invalid individual values produce diagnostics while later safe entries remain recoverable.
- Large or extreme values are rejected before allocation or reading. Known numeric component decoding has an additional small hard cap.
- Duplicate tags remain ordered; unknown tags retain structure without arbitrary binary payload copies.
- MakerNote stays opaque and is never recursively interpreted.
- RATIONAL and SRATIONAL preserve exact components; zero denominators produce diagnostics rather than division.
- No thumbnail, TIFF image, JPEG image, or pixel data is decoded.

Every traversal or decoding loop has a validated finite count or advances a bounded cursor. Native `DataView` bounds errors are not used as control flow.

## Environment and dependencies

Core code is local-only and side-effect-free. It has no network, analytics, telemetry, filesystem, DOM, or pixel-codec behavior. The package has zero runtime dependencies.
