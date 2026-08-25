# Format Support

| Capability                    | JPEG             | WebP           | PNG                                   |
| ----------------------------- | ---------------- | -------------- | ------------------------------------- |
| Signature detection           | Supported        | Supported      | Supported                             |
| Bounded container traversal   | Supported        | Supported      | Supported                             |
| EXIF container detection      | Supported        | Supported      | Supported (`eXIf`)                    |
| XMP detection                 | Supported        | Supported      | Supported (exact XMP `iTXt` keyword)  |
| ICC detection                 | Supported        | Supported      | Supported (`iCCP`)                    |
| TIFF/EXIF field decoding      | Supported subset | Container only | Supported subset via shared TIFF core |
| MakerNote decoding            | Not supported    | Not supported  | Not supported                         |
| XMP/IPTC/ICC payload decoding | Not supported    | Not supported  | Not supported                         |
| Whole-container cleaning      | Supported        | Supported      | Supported                             |
| Structured verification       | Supported        | Supported      | Supported                             |

## PNG detail

| PNG capability                            | Status                           |
| ----------------------------------------- | -------------------------------- |
| Signature and chunk traversal             | Supported                        |
| `tEXt`, `zTXt`, `iTXt` detection          | Supported                        |
| Exact XMP `iTXt` detection                | Supported                        |
| `eXIf` detection and shared TIFF decoding | Supported                        |
| `iCCP` and `tIME` detection               | Supported                        |
| CRC-32 validation                         | Supported; mismatch is a warning |
| Rendering/color and APNG classification   | Supported at chunk level         |
| Compressed text decompression             | Not supported                    |
| ICC decompression                         | Not supported                    |
| IDAT/APNG decoding                        | Not supported                    |
| Privacy Clean and verification            | Supported                        |

The shared TIFF subset covers common IFD0, ExifIFD, GPSIFD, and next-IFD entries with bounded tables, offsets, depth, counts, and cycles. PNG `eXIf` begins directly at TIFF byte zero; JPEG begins after `Exif\0\0`. WebP EXIF remains container-only because its payload convention is not guessed.

## Container cleaning and verification

JPEG removes EXIF, XMP, Photoshop/IPTC, and comments. WebP removes EXIF and XMP, repairs RIFF size, and aligns retained VP8X flags. PNG removes `eXIf`, XMP and ordinary text chunks, and `tIME`; it preserves ICC, rendering/color, IDAT, APNG, unknown, critical, CRC, and trailing bytes by default.

Verification reports observable supported metadata-container presence or absence. It does not decode XMP/IPTC/ICC or compressed PNG text, prove byte provenance, or prove complete removal of personal information.
