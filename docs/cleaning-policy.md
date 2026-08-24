# Cleaning Policy Direction

Cleaning is not implemented in Sprint 0. This document records the intended conservative policy for future work.

An initial privacy-clean mode should remove EXIF, GPS, XMP, IPTC, comments, and privacy-relevant textual metadata. It should preserve the encoded image payload, required container structures, ICC and other color profiles, rendering-critical metadata, and unknown structures unless the relevant format specification proves removal is safe.

For v0.1, whole EXIF containers are preferred over selective TIFF rewriting:

```text
JPEG APP1 EXIF → remove whole EXIF APP1
PNG eXIf       → remove whole eXIf chunk
WebP EXIF      → remove whole EXIF chunk
```

Selective EXIF field rewriting is postponed. This reduces offset-rewrite complexity and makes cleaner behavior easier to audit. Unaffected bytes should remain byte-for-byte identical whenever the container format permits it, and output must be re-inspected rather than trusted merely because a write completed.
