# Security Model

Binary metadata parsing processes attacker-controlled structures, sizes, offsets, encodings, and nesting. Malformed files, parser crashes, excessive allocation or traversal, and incorrect offset arithmetic are security concerns.

## Invariants

1. All binary input is untrusted and all reads use bounded primitives.
2. Parsers perform no unchecked offset arithmetic or unbounded recursion.
3. Parser traversal and attacker-controlled counts are hard bounded.
4. Core functions make no network requests and access no filesystem or DOM APIs.
5. Image pixel payloads are never decoded.
6. Unknown metadata is not deleted or assigned speculative meaning.
7. JPEG and WebP cleaning preserve ICC, unknown structures, and image/rendering structures by default.
8. Cleaner output is re-inspected before it is returned.
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

## JPEG cleaning properties

Cleaning proceeds only after bounded traversal reaches EOI. Truncated lengths, invalid marker structure, unterminated scans, and segment-limit failures produce a typed `IncompleteJpegError`; no partial output is returned. TIFF validity is not required to remove a structurally bounded EXIF APP1.

Removal uses checked, non-overlapping parser ranges. Output length is a safe integer no larger than input length, one output buffer is allocated, and retained ranges are copied in original order. Entropy-coded bytes, restart markers, retained marker fill, structural segments, and bytes after EOI are neither decoded nor regenerated. Exact `Uint8Array` views are honored and caller input is never mutated.

The default policy preserves every ICC and unknown APP segment. Verification proves only the requested observable container state supported by inspection. It does not prove provenance, byte preservation without an original, absence of unknown metadata, or absence of personal information in pixels or unsupported structures.

## WebP parsing and cleaning properties

The parser validates the 12-byte RIFF/WebP header, checked declared RIFF boundary, complete eight-byte chunk headers, payload lengths, odd-byte padding, VP8X length/uniqueness, and `maxChunks`. Every chunk loop either advances by its validated physical length or terminates. Trailing bytes outside the declared RIFF boundary are warned about, not parsed.

VP8, VP8L, VP8X, ALPH, ANIM, ANMF, ICCP, and unknown chunk payloads remain opaque. Privacy Clean removes whole EXIF and XMP chunks, including their padding. ICCP and unknown chunks remain by default. Reconstruction allocates one output buffer, copies retained physical chunks in order, patches only VP8X ICC/EXIF/XMP flag bits, repairs the little-endian RIFF size, and preserves trailing bytes outside that size.

Unsafe RIFF/chunk boundaries, missing padding, invalid or duplicate VP8X, and chunk-limit failures produce `IncompleteWebPError` before output. Malformed EXIF/XMP payloads do not block safe whole-chunk removal. WebP verification observes supported chunk presence only and makes no claim about provenance, unknown metadata, pixels, or complete personal-information removal.
