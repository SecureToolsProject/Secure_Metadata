# Architecture

`secure-metadata` is a side-effect-free binary library with format-specific containers and a shared metadata decoder.

```text
JPEG APP1 Exif\0\0 ─┐
PNG eXIf             ┴──→ bounded TIFF/EXIF core → normalized entries
WebP EXIF                 → normalized container entry only
```

JPEG passes the TIFF decoder the view after its six-byte EXIF identifier. PNG passes the exact `eXIf` data view directly. In both cases TIFF offset zero is the beginning of that bounded view; integrations relocate source offsets and diagnostics only after parsing.

## TIFF core

The decoder validates byte order, magic 42, complete IFD tables, field sizes, offset values, and linked traversal. A FIFO queue plus visited-offset set provides deterministic IFD0, ExifIFD, GPSIFD, and next-IFD traversal. `maxIfdEntries`, `maxIfdDepth`, `maxMetadataEntries`, and `maxStringBytes` bound work. Known values retain exact rationals; unknown tags remain structural, and MakerNote stays opaque.

## Inspection status

- `format-only`: unknown input where only format detection applies.
- `container-inspected`: complete JPEG, WebP, or PNG traversal without TIFF decoding.
- `container-partial`: traversal stopped on structural invalidity or a limit.
- `metadata-partial`: complete JPEG or PNG traversal where common TIFF/EXIF decoding was attempted while broader metadata remains intentionally opaque.
- `metadata-inspected`: reserved for future broader decoders.

## Cleaning flows

JPEG and WebP use their format-specific parsers and reconstruction rules. JPEG copies retained marker/scan ranges into one output. WebP copies retained chunks, repairs RIFF size, and aligns retained VP8X metadata bits.

```text
PNG bytes
  → bounded PNG chunk parser and metadata classification
  → shared TIFF decoder for eXIf inspection
  → direct keep/remove policy
  → checked retained physical ranges
  → one output allocation and ordered byte copies
  → inspectMetadata(output)
  → structured verification checks
```

The PNG cleaner parses the source once for boundaries, never routes decisions through semantic entries, and does not decode TIFF before removing a bounded `eXIf`. It copies the signature, retained complete chunks, and bytes after IEND. Retained length/type/data/CRC bytes and relative order are unchanged. IDAT, APNG, compressed text, and ICC payloads stay opaque.
