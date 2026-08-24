# Format Support

| Capability                  | JPEG                   | PNG            | WebP           |
| --------------------------- | ---------------------- | -------------- | -------------- |
| Signature detection         | Supported              | Supported      | Supported      |
| Bounded container traversal | Supported              | Not yet        | Not yet        |
| EXIF container detection    | Supported              | Not yet        | Not yet        |
| TIFF header and IFD0        | Supported through JPEG | Not integrated | Not integrated |
| ExifIFD and GPSIFD          | Supported through JPEG | Not integrated | Not integrated |
| Common EXIF/GPS fields      | Supported subset       | Not integrated | Not integrated |
| MakerNote decoding          | Not supported          | Not supported  | Not supported  |
| XMP payload decoding        | Not yet                | Not yet        | Not yet        |
| IPTC/ICC payload decoding   | Not yet                | Not yet        | Not yet        |
| Cleaning and verification   | Not yet                | Not yet        | Not yet        |

## TIFF/EXIF subset

Both `II` and `MM` byte orders are supported. Traversal covers IFD0, ExifIFDPointer, GPSInfoIFDPointer, and next-IFD links with table, entry, depth, offset, and cycle checks.

Decoded IFD0 tags: ImageDescription, Make, Model, Orientation, Software, DateTime, Artist, and Copyright.

Decoded ExifIFD tags: ExposureTime, FNumber, PhotographicSensitivity, ExifVersion, DateTimeOriginal, DateTimeDigitized, FocalLength, PixelXDimension, PixelYDimension, and FocalLengthIn35mmFilm. MakerNote is named and retained as opaque structure.

Decoded GPS tags: GPSVersionID, GPSLatitudeRef, GPSLatitude, GPSLongitudeRef, GPSLongitude, GPSAltitudeRef, GPSAltitude, GPSTimeStamp, and GPSDateStamp. Coordinates remain exact raw rational components plus reference fields; decimal coordinates are not derived.

Unknown tags remain structurally represented without speculative meaning or large binary values.

## Remaining container support

JPEG marker and scan traversal remains supported. XMP, ICC, and Photoshop/IPTC signatures are container-detected only. PNG requires its complete signature and WebP requires `RIFF....WEBP`; their chunks and metadata are not parsed yet.
