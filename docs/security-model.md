# Security Model

Binary metadata parsing processes attacker-controlled structures, sizes, offsets, encodings, and nesting. Malformed files, parser crashes, excessive allocation or traversal, and incorrect offset arithmetic are security concerns.

## Invariants

1. All input is untrusted and all reads use bounded primitives.
2. Parsers use checked range arithmetic, finite iteration limits, and no unbounded recursion.
3. Core functions make no network requests and access no filesystem or DOM APIs.
4. Image pixels and compressed image/metadata payloads are never decoded.
5. Unknown structures are not assigned speculative meaning or removed by default.
6. ICC, rendering/color, and image structures are preserved by default.
7. Cleaner output is re-inspected before return.
8. Metadata absence never proves an image has no private pixels, unsupported metadata, steganography, malware, or provenance concerns.

## Bounded binary and TIFF properties

Offsets and lengths must be non-negative safe integers. Ranges use subtraction-based capacity checks before access. TIFF decoders receive bounded TIFF-only views: after the JPEG EXIF identifier or at PNG `eXIf` data byte zero. IFD table size, `count × typeSize`, inline/offset value locations, linked depth, entry count, metadata count, string length, and cycles are checked. Unsupported values produce diagnostics; MakerNote, thumbnails, and pixels remain opaque.

## JPEG and WebP properties

JPEG traversal validates marker and scan progression through EOI before cleaning; malformed structure produces `IncompleteJpegError`. Retained scan, marker, and trailing bytes are copied in one allocation. WebP validates the RIFF boundary, complete chunk headers/payload/padding, VP8X constraints, and chunk limits; malformed structure produces `IncompleteWebPError`. Its cleaner copies retained chunks, repairs RIFF size, and updates only applicable VP8X metadata bits.

## PNG parsing and cleaning properties

The PNG parser requires the complete signature and validates every big-endian length, four-letter type, data range, and CRC field before advancing. `maxChunks` bounds traversal. IEND stops logical parsing; trailing bytes are warned about and preserved rather than interpreted. Missing IEND, truncated fields, impossible ranges, and limit failures produce `IncompletePngError` before output.

CRC-32 is checked over each chunk type and data. A mismatch produces a warning but does not obscure otherwise valid whole-chunk boundaries; the cleaner may remove targeted chunks but never repairs or mutates retained CRCs.

IDAT and APNG payloads are never decoded or rewritten. `zTXt`, compressed `iTXt`, and `iCCP` are never inflated, avoiding metadata decompression-bomb exposure in this sprint. A malformed but bounded text or `eXIf` payload can still be removed as a whole chunk. Unknown ancillary, critical, ICC, and rendering/color chunks are preserved by default. Reconstruction parses once, calculates checked retained ranges, allocates one output, and copies complete chunks and trailing bytes in order. Exact caller subviews are honored and inputs are never mutated.

## Environment and dependencies

Core code is local-only and side-effect-free, with zero runtime dependencies. Verification observes supported container presence only; it cannot prove provenance, absence of unknown metadata, or complete removal of personal information.
