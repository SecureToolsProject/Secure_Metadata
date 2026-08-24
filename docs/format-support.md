# Format Support

Sprint 1 implements deterministic container signature detection only. Planned parser implementation priority remains:

1. JPEG
2. WebP
3. PNG

Detection order is explicitly PNG, JPEG, WebP, then unknown. The supported signatures are distinct, so the ordering does not create heuristic ambiguity.

## JPEG

**Implemented:** detection when the first two bytes are `FF D8`.

This does not require an EOI marker and does not validate or traverse markers or segments. APP segments, EXIF, shared TIFF IFD and GPS decoding, XMP, IPTC, comments, and ICC distinctions remain future work. Malformed trailing bytes do not change a matching Sprint 1 signature classification.

## WebP

**Implemented:** detection of `RIFF` at offset 0 and `WEBP` at offset 8, requiring at least 12 bytes.

The four RIFF size bytes are deliberately ignored. RIFF size validation, chunk traversal, EXIF, XMP, ICCP, image and animation payload distinctions, and VP8X consistency handling remain future work.

## PNG

**Implemented:** detection of the complete eight-byte PNG signature `89 50 4E 47 0D 0A 1A 0A`.

A truncated or corrupted signature is unknown. IHDR and chunk structure are not inspected. Textual metadata, eXIf, XMP, ICC and color chunks, privacy-relevant ancillary chunks, CRC checking, and compressed metadata remain future work.

`inspectionStatus: "format-only"` records this boundary in API results. A detected signature is not a claim that a file is structurally valid or that its metadata has been inspected.
