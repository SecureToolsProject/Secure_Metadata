# Architecture

`secure-metadata` is organized as a side-effect-free binary library. Its current and planned flow is:

```text
Input bytes                              implemented
    ↓
Safe binary view / bounded reads         implemented
    ↓
Format detection                         implemented
    ↓
JPEG container parser                    implemented for JPEG
    ↓
Metadata container classification        implemented for JPEG
    ↓
Metadata payload decoder                 planned
    ↓
Normalization / field classification     planned
    ↓
Policy engine and cleaner                planned
    ↓
Output re-inspection / verification      planned
```

## Binary core

Input normalization returns the caller's exact `Uint8Array` view or creates a no-copy view over an `ArrayBuffer`. `ByteReader` validates offsets and lengths as non-negative safe integers and checks remaining capacity with subtraction before every read. It provides bounded unsigned 8-, 16-, and 32-bit reads, subarray views, and allocation-free signature matching.

## JPEG container layer

The iterative JPEG parser validates SOI and walks markers using the binary core. A central marker model distinguishes SOI, EOI, TEM, RST0–RST7, APP0–APP15, COM, SOS, common image-structure markers, and length-prefixed unknown markers. Repeated `FF` fill bytes are collapsed to one marker; declared lengths include their two-byte length field and must fit fully before offsets advance.

After SOS, the parser scans rather than decodes entropy data. `FF 00` remains stuffed data, restart markers are recorded without terminating the scan, and the next real marker resumes normal traversal. This supports multiple scans. Every marker, including SOI, EOI, SOS, and restarts, counts toward `maxSegments`.

APP signatures are checked within segment payload boundaries without retaining payload copies. EXIF, standard/extended XMP, ICC, Photoshop/IPTC, JFIF/JFXX, Adobe, and unknown classifications remain container-level observations.

## Inspection status

- `format-only`: a signature was detected; no container parser ran. Currently PNG, WebP, unknown, and short arbitrary inputs.
- `container-inspected`: JPEG traversal reached EOI safely.
- `container-partial`: JPEG identity is known, but traversal stopped on a structural error, truncation, or limit.
- `metadata-inspected`: reserved for future payload decoders.

An empty entry list means no supported metadata container was recognized during the completed portion of traversal. It does not prove metadata or private information is absent.
