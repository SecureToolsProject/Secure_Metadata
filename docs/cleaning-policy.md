# Cleaning Policy

JPEG Privacy Clean removes complete recognized metadata containers. It never rewrites TIFF/EXIF fields, XMP XML, IPTC blocks, comments, or ICC payloads.

| JPEG structure                         | Default action |
| -------------------------------------- | -------------- |
| EXIF APP1                              | Remove         |
| Standard XMP APP1                      | Remove         |
| Extended XMP APP1                      | Remove         |
| Photoshop/IPTC APP13                   | Remove         |
| COM                                    | Remove         |
| ICC APP2                               | Preserve       |
| JFIF/JFXX APP0                         | Preserve       |
| Adobe APP14                            | Preserve       |
| Unknown APP                            | Preserve       |
| Structural markers and image/scan data | Preserve       |
| Data after EOI                         | Preserve       |

Every recognized instance is handled independently and retained content keeps its original order and bytes. Unknown APP removal is intentionally unavailable in Sprint 4. Callers may override the four removal booleans and ICC preservation; `preserveColorProfiles` remains a deprecated alias for `preserveIcc`.

v0.1 removes the entire EXIF APP1, including malformed TIFF bodies whose JPEG segment boundary is valid. Selective GPS or tag rewriting and TIFF reserialization are deferred.

`cleanMetadata` returns a new `Uint8Array`, container-level removed/preserved records, diagnostics, and an inspection report of the produced JPEG. A structurally incomplete JPEG is rejected before allocation. PNG, WebP, and unknown inputs return a typed unsupported-format error.
