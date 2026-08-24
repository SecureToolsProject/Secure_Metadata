# Format Support

No image format is parsed in Sprint 0. Planned implementation priority is:

1. JPEG
2. WebP
3. PNG

## JPEG

JPEG is first because its segment model provides the initial foundation for marker parsing and bounded traversal. Future work covers APP segments, EXIF, shared TIFF IFD and GPS decoding, XMP, IPTC, comments, and the distinction between privacy metadata and ICC profiles.

## WebP

WebP support will add bounded RIFF chunk parsing, EXIF, XMP, ICCP, image and animation payload distinctions, and consistent handling of VP8X feature flags when metadata chunks change.

## PNG

PNG support will add chunk parsing, textual metadata, eXIf, XMP, ICC and color chunks, privacy-relevant ancillary chunks, and detection of compressed metadata. Compressed metadata decompression is not part of Sprint 0.

Format claims will track implemented and tested behavior; planned items are not advertised as supported.
