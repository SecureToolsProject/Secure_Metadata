# Cleaning Policy

Privacy Clean applies one normalized semantic policy, then maps it directly to each format's physical containers. Binary reconstruction remains format-specific.

## Semantic defaults

| Policy field         | Default | Meaning                                            |
| -------------------- | ------- | -------------------------------------------------- |
| `removeExif`         | `true`  | Remove private EXIF; retain valid JPEG Orientation |
| `removeXmp`          | `true`  | Remove recognized XMP containers                   |
| `removeIptc`         | `true`  | Remove recognized IPTC containers                  |
| `removeComments`     | `true`  | Remove recognized comment containers               |
| `removeTextMetadata` | `true`  | Remove recognized ordinary text metadata           |
| `removeTimestamps`   | `true`  | Remove recognized standalone timestamp metadata    |
| `preserveIcc`        | `true`  | Preserve recognized ICC containers                 |

Unknown, rendering, and image data are preserved. JPEG Orientation is rendering metadata: when the input has exactly one fully decoded IFD0 Orientation with TIFF type SHORT, count 1, and value 1 through 8, cleaning rewrites it into a canonical minimal EXIF APP1 segment. No pixel decode, rotation, or re-encoding occurs. Missing, malformed, out-of-range, incomplete, or ambiguous Orientation is not guessed and the EXIF container is removed. `preserveColorProfiles` remains a deprecated alias for `preserveIcc`: explicit `preserveIcc` wins, otherwise the alias is used, otherwise the default applies. The exported `DEFAULT_CLEANING_POLICY` is authoritative; legacy format-named defaults reference the same frozen object.

## JPEG mapping

| Semantic field   | Physical mapping                             |
| ---------------- | -------------------------------------------- |
| `removeExif`     | EXIF APP1 except canonical valid Orientation |
| `removeXmp`      | Standard and extended XMP APP1               |
| `removeIptc`     | Photoshop/IPTC APP13                         |
| `removeComments` | COM                                          |
| `preserveIcc`    | ICC APP2                                     |

JFIF/JFXX, Adobe APP14, unknown APP segments, structural markers, scan data, and data after EOI are preserved byte-for-byte. A rewritten EXIF segment contains only the TIFF header, one IFD0 Orientation entry, and a zero next-IFD pointer; all device, software, timestamp, location, identity, description, rights, MakerNote, thumbnail, and unknown EXIF fields are removed.

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

One removed or rewritten physical container produces one source-ordered removal record. Rewritten JPEG Orientation also produces a preservation record. Canonical Orientation-only EXIF is considered absent for the JPEG `exif: "absent"` privacy expectation; Orientation combined with any other EXIF or GPS entry remains present and fails verification. `cleanMetadata` always returns a distinct output view, change evidence, bounded diagnostics, and one re-inspection report. Valid outer boundaries permit whole-container removal even when inner metadata is malformed; unsafe container boundaries produce a typed incomplete-format error without output.
