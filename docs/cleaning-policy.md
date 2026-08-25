# Cleaning Policy

Privacy Clean applies one normalized semantic policy, then maps it directly to each format's physical containers. Binary reconstruction remains format-specific.

## Semantic defaults

| Policy field         | Default | Meaning                                         |
| -------------------- | ------- | ----------------------------------------------- |
| `removeExif`         | `true`  | Remove recognized EXIF containers               |
| `removeXmp`          | `true`  | Remove recognized XMP containers                |
| `removeIptc`         | `true`  | Remove recognized IPTC containers               |
| `removeComments`     | `true`  | Remove recognized comment containers            |
| `removeTextMetadata` | `true`  | Remove recognized ordinary text metadata        |
| `removeTimestamps`   | `true`  | Remove recognized standalone timestamp metadata |
| `preserveIcc`        | `true`  | Preserve recognized ICC containers              |

Unknown, rendering, and image data are preserved. `preserveColorProfiles` remains a deprecated alias for `preserveIcc`: explicit `preserveIcc` wins, otherwise the alias is used, otherwise the default applies. The exported `DEFAULT_CLEANING_POLICY` is authoritative; legacy format-named defaults reference the same frozen object.

## JPEG mapping

| Semantic field   | Physical mapping               |
| ---------------- | ------------------------------ |
| `removeExif`     | EXIF APP1                      |
| `removeXmp`      | Standard and extended XMP APP1 |
| `removeIptc`     | Photoshop/IPTC APP13           |
| `removeComments` | COM                            |
| `preserveIcc`    | ICC APP2                       |

JFIF/JFXX, Adobe APP14, unknown APP segments, structural markers, scan data, and data after EOI are preserved.

## WebP mapping

| Semantic field | Physical mapping |
| -------------- | ---------------- |
| `removeExif`   | EXIF chunk       |
| `removeXmp`    | XMP chunk        |
| `preserveIcc`  | ICCP chunk       |

Other semantic fields are not applicable. VP8/VP8L, ALPH, ANIM/ANMF, unknown chunks, and trailing data are preserved. RIFF size and only necessary VP8X ICC/EXIF/XMP bits are repaired.

## PNG mapping

| Semantic field       | Physical mapping                    |
| -------------------- | ----------------------------------- |
| `removeExif`         | `eXIf`                              |
| `removeXmp`          | Exact XMP `iTXt`                    |
| `removeTextMetadata` | Ordinary `tEXt`, `zTXt`, and `iTXt` |
| `removeTimestamps`   | `tIME`                              |
| `preserveIcc`        | `iCCP`                              |

Rendering/color chunks, IDAT, APNG structure, unknown ancillary and critical chunks, retained CRCs, and data after IEND are preserved. Compressed text and ICC payloads are never decompressed.

One removed physical container produces one source-ordered change record. `cleanMetadata` always returns a distinct output view, change evidence, bounded diagnostics, and one re-inspection report. Valid outer boundaries permit whole-container removal even when inner metadata is malformed; unsafe container boundaries produce a typed incomplete-format error without output.
