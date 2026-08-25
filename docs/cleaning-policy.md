# Cleaning Policy

Privacy Clean removes complete recognized metadata containers and never decodes or re-encodes image payloads.

## JPEG

| JPEG structure                                    | Default action |
| ------------------------------------------------- | -------------- |
| EXIF APP1; standard/extended XMP APP1             | Remove         |
| Photoshop/IPTC APP13; COM                         | Remove         |
| ICC APP2; JFIF/JFXX; Adobe APP14                  | Preserve       |
| Unknown APP; structural/scan data; data after EOI | Preserve       |

## WebP

| WebP chunk or data                       | Default action                     |
| ---------------------------------------- | ---------------------------------- |
| EXIF; XMP                                | Remove                             |
| ICCP; VP8/VP8L; ALPH; ANIM/ANMF; unknown | Preserve                           |
| VP8X                                     | Preserve; align ICC/EXIF/XMP flags |
| Data after declared RIFF boundary        | Preserve                           |

WebP cleaning removes targeted physical chunks including padding, repairs RIFF size, and patches only the three VP8X metadata bits. No VP8X is synthesized.

## PNG

| PNG chunk or data                      | Default action |
| -------------------------------------- | -------------- |
| `eXIf`                                 | Remove         |
| XMP `iTXt`                             | Remove         |
| Ordinary `tEXt`, `zTXt`, and `iTXt`    | Remove         |
| `tIME`                                 | Remove         |
| `iCCP`                                 | Preserve       |
| `gAMA`, `cHRM`, `sRGB`, `sBIT`, `pHYs` | Preserve       |
| `IDAT`; APNG structure                 | Preserve       |
| Unknown ancillary; critical chunks     | Preserve       |
| Data after `IEND`                      | Preserve       |

Compressed text and ICC payloads are removed or preserved as whole chunks without decompression. Retained physical chunks—including their original CRC bytes—and trailing data remain byte-identical and ordered.

The shared fields `removeExif`, `removeXmp`, and `preserveIcc` apply across supported formats. PNG also uses `removeTextMetadata` and `removeTimestamps`; JPEG-only `removeIptc` and `removeComments` have no PNG effect. `preserveColorProfiles` remains a deprecated alias for `preserveIcc`. Unknown removal is intentionally unavailable.

`cleanMetadata` always returns a new `Uint8Array`, change evidence, diagnostics, and a re-inspection report. Unsafe container boundaries reject cleaning before output. Unknown formats return a typed unsupported-format error.
