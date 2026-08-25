# Architecture

`secure-metadata` is a side-effect-free binary library with format-specific containers and shared metadata decoders.

```text
JPEG APP1 Exif\0\0 ─┐
PNG eXIf (future)    ┴──→ bounded TIFF/EXIF core → normalized entries
WebP EXIF                → normalized container entry only
```

JPEG integration passes the TIFF decoder only the byte view after the six-byte EXIF identifier. The decoder has no JPEG marker or absolute file-offset knowledge. Every TIFF offset is relative to byte zero of that view. Integration relocates decoded source offsets and diagnostics only after parsing.

## TIFF core

The decoder explicitly validates `II` or `MM`, magic value 42, and the first IFD offset. `TiffReader` centralizes endian-aware unsigned 16-/32-bit and signed 32-bit access over the bounded binary core.

Each IFD table is validated as a complete `2 + count × 12 + 4` byte range before entries are visited. Field sizes support BYTE, ASCII, SHORT, LONG, RATIONAL, UNDEFINED, SLONG, and SRATIONAL. Values of four bytes or fewer use the entry's inline bytes in TIFF byte order; larger values use a bounded TIFF-relative offset.

Traversal uses a FIFO work queue. Root IFD0 has depth 1; ExifIFD, GPSIFD, and next-IFD work is queued deterministically in that order. A visited-offset set rejects cycles and repeated references. `maxIfdEntries` bounds each table, `maxIfdDepth` bounds linked depth, and `maxMetadataEntries` caps total processed entries and queued IFD work.

## Value and entry behavior

Supported known values are decoded without converting exact rational pairs to floating point. ASCII stops at the first NUL within its declared count and maps non-ASCII bytes conservatively. Zero rational denominators remain represented and produce diagnostics.

Unknown tags retain namespace, tag number, TIFF type, count, entry offset, and source path without exposing arbitrary payload bytes. Duplicate tags remain separate ordered entries. MakerNote is recognized but opaque and is never interpreted as nested standard TIFF.

## Inspection status

- `format-only`: signature detection only; currently PNG and unknown input.
- `container-inspected`: JPEG or WebP container traversal completed without deep metadata decoding.
- `container-partial`: JPEG or WebP traversal stopped on corruption, truncation, structural invalidity, or a limit.
- `metadata-partial`: JPEG container traversal completed and common TIFF/EXIF decoding was attempted; XMP/IPTC/ICC and unknown fields remain incomplete.
- `metadata-inspected`: reserved for future broader decoders.

## JPEG clean and verify flow

```text
input JPEG
  → bounded JPEG parser and existing APP classification
  → direct keep/remove policy
  → checked retained ranges
  → one output allocation and ordered byte copies
  → inspectMetadata(output)
  → structured verification checks
```

The parser remains the structural source of truth. Internal rewrite ranges include marker fill bytes associated with a removed marker while public source offsets retain their existing meaning. Cleaning does not invoke TIFF decoding on the source: a structurally bounded EXIF APP1 can be removed even if its TIFF body is malformed. The post-write inspection and verifier use the normal inspection layer.

## WebP clean and verify flow

```text
WebP bytes
  → bounded RIFF/WebP parser and FourCC classification
  → direct EXIF/XMP/ICC policy
  → retained chunks
  → minimal VP8X metadata-bit patch
  → RIFF size patch
  → one output allocation and ordered chunk copies
  → inspectMetadata(output)
  → structured verification checks
```

Chunk payloads remain bounded views and image, alpha, and animation bytes are opaque. The cleaner does not synthesize VP8X; a valid retained VP8X has only its ICC, EXIF, and XMP bits aligned with actual retained chunks. Bytes outside the declared RIFF container are copied as uninterpreted trailing data.
