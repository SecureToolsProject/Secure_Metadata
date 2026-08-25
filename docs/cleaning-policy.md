# Cleaning Policy

Privacy Clean removes complete recognized metadata containers and never decodes or re-encodes image payloads.

## JPEG

| JPEG structure                         | Default action |
| -------------------------------------- | -------------- |
| EXIF APP1                              | Remove         |
| Standard/extended XMP APP1             | Remove         |
| Photoshop/IPTC APP13                   | Remove         |
| COM                                    | Remove         |
| ICC APP2                               | Preserve       |
| JFIF/JFXX APP0                         | Preserve       |
| Adobe APP14                            | Preserve       |
| Unknown APP                            | Preserve       |
| Structural markers and image/scan data | Preserve       |
| Data after EOI                         | Preserve       |

JPEG v0.1 removes the entire EXIF APP1, including malformed TIFF bodies whose JPEG segment boundary is valid. Selective GPS/tag rewriting and TIFF reserialization are deferred.

## WebP

| WebP chunk or data                | Default action                     |
| --------------------------------- | ---------------------------------- |
| EXIF                              | Remove                             |
| XMP                               | Remove                             |
| ICCP                              | Preserve                           |
| VP8 / VP8L                        | Preserve                           |
| VP8X                              | Preserve; align ICC/EXIF/XMP flags |
| ALPH                              | Preserve                           |
| ANIM / ANMF                       | Preserve                           |
| Unknown chunks                    | Preserve                           |
| Data after declared RIFF boundary | Preserve                           |

WebP cleaning removes every targeted physical chunk including odd-byte padding, repairs the RIFF size, and patches only the three VP8X metadata feature bits. Alpha, animation, reserved, and other VP8X bits remain unchanged. No VP8X is synthesized. Structurally bounded malformed metadata payloads remain removable.

The shared policy fields `removeExif`, `removeXmp`, and `preserveIcc` apply to both formats. JPEG-only `removeIptc` and `removeComments` have no WebP effect. `preserveColorProfiles` remains a deprecated alias for `preserveIcc`. Unknown removal is intentionally unavailable.

`cleanMetadata` returns a new `Uint8Array`, container-level change evidence, diagnostics, and an inspection report of its output. Structurally incomplete input is rejected before output allocation. PNG and unknown formats return a typed unsupported-format error.
