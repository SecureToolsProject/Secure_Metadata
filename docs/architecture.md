# Architecture

`secure-metadata` is a side-effect-free binary library with shared semantic policy and format-specific container logic.

```text
input
  → format detection
  → JPEG / WebP / PNG bounded container parser
  → optional shared TIFF decoder (JPEG EXIF, PNG eXIf)
  → normalized metadata report
  → normalized semantic cleaning policy
  → format-specific conservative reconstruction
  → one output re-inspection
  → observational verification
```

Shared semantic policy does not imply a shared binary writer. JPEG copies retained marker/scan ranges. WebP copies retained chunks and repairs RIFF size plus applicable VP8X metadata bits. PNG copies complete retained chunks and original CRC bytes. Each cleaner performs one input container parse, one final output allocation, and one output inspection.

## Shared TIFF core

JPEG passes the view after `Exif\0\0`; PNG passes exact `eXIf` data. TIFF byte zero, tag definitions, rational representation, diagnostics, and internal paths such as `IFD0/ExifIFD/DateTimeOriginal` are shared. Outer source containers and relocated absolute offsets remain format-specific. WebP EXIF remains container-only.

Traversal validates byte order, magic, complete IFD tables, field sizes, offset values, cycles, and progress. `maxIfdEntries`, `maxIfdDepth`, `maxMetadataEntries`, `maxStringBytes`, and `maxDiagnostics` bound work and reporting.

## Inspection status

- `format-only`: only format detection is available; currently unknown input.
- `container-inspected`: the supported JPEG, WebP, or PNG container structure was fully traversed without shared TIFF decoding.
- `container-partial`: container traversal stopped because structure was unsafe or a structural limit was reached.
- `metadata-partial`: JPEG or PNG container traversal completed and the supported TIFF/EXIF subset was attempted, while broader metadata semantics remain intentionally incomplete.
- `metadata-inspected`: reserved for future exhaustive metadata decoders.

A report includes `metadataTruncated: true` when its entry budget is reached; a diagnostic is also emitted when the diagnostic budget permits. Verification fails closed rather than deriving absence from a truncated report.
