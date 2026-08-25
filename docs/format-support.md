# Format Support

| Capability                    | JPEG             | WebP           | PNG            |
| ----------------------------- | ---------------- | -------------- | -------------- |
| Signature detection           | Supported        | Supported      | Supported      |
| Bounded container traversal   | Supported        | Supported      | Not yet        |
| EXIF container detection      | Supported        | Supported      | Not yet        |
| XMP/ICC container detection   | Supported        | Supported      | Not yet        |
| TIFF/EXIF field decoding      | Supported subset | Container only | Not integrated |
| MakerNote decoding            | Not supported    | Not supported  | Not supported  |
| XMP/IPTC/ICC payload decoding | Not supported    | Not supported  | Not supported  |
| Whole-container cleaning      | Supported        | Supported      | Not yet        |
| Structured verification       | Supported        | Supported      | Not yet        |

## TIFF/EXIF subset

JPEG integrates the shared little- and big-endian TIFF decoder. Traversal covers IFD0, ExifIFDPointer, GPSInfoIFDPointer, and next-IFD links with table, entry, depth, offset, and cycle checks.

Decoded IFD0 tags: ImageDescription, Make, Model, Orientation, Software, DateTime, Artist, and Copyright.

Decoded ExifIFD tags: ExposureTime, FNumber, PhotographicSensitivity, ExifVersion, DateTimeOriginal, DateTimeDigitized, FocalLength, PixelXDimension, PixelYDimension, and FocalLengthIn35mmFilm. MakerNote remains opaque.

Decoded GPS tags include version, latitude/longitude components and references, altitude, time, and date. Coordinates remain exact rational components; decimal coordinates are not derived.

WebP EXIF is intentionally container detection only. Its bounded chunk payload is not passed to TIFF decoding because Sprint 5 does not guess a prefix or offset base.

## Container cleaning and verification

JPEG Privacy Clean removes EXIF, standard/extended XMP, Photoshop/IPTC, and comments while preserving ICC, application/rendering structures, scan data, unknown APP segments, and trailing bytes.

WebP Privacy Clean removes EXIF and XMP chunks while preserving ICCP, VP8/VP8L, VP8X, ALPH, ANIM/ANMF, unknown chunks, original padding on retained chunks, and trailing bytes. It repairs RIFF size and retained VP8X metadata flags.

Verification reports observable supported metadata-container presence or absence. It does not decode XMP/IPTC/ICC, prove byte provenance, or prove complete removal of personal information. PNG remains format detection only.
