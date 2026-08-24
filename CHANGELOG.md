# Changelog

All notable changes will be documented here. The project intends to follow semantic versioning once releases begin.

## Unreleased

### Added

- Deterministic JPEG Privacy Clean for whole EXIF, XMP, Photoshop/IPTC, and COM segments.
- Checked single-allocation JPEG reconstruction preserving ICC, unknown APP, structural, scan, and trailing bytes.
- Structured JPEG presence/absence verification and typed unsupported/incomplete-input errors.
- Compact canonical coverage for determinism, idempotency, multiple scans and metadata instances, malformed TIFF removal, and exact subviews.

- Shared bounded little- and big-endian TIFF/EXIF decoder.
- Iterative IFD0, ExifIFD, GPSIFD, and next-IFD traversal.
- IFD entry/depth limits and repeated-offset cycle protection.
- Inline and TIFF-relative offset value handling for common field types.
- Exact RATIONAL/SRATIONAL, conservative ASCII, and full-range LONG/SLONG decoding.
- Common IFD0, ExifIFD, and GPS tag normalization with deterministic source paths.
- JPEG EXIF child-field inspection through bounded TIFF-only subviews.
- Structured malformed header, table, pointer, value, type, rational, limit, and cycle diagnostics.
- Bounded JPEG marker traversal and EXIF/XMP/ICC/IPTC container detection.
- Binary boundary, JPEG container, TIFF endian, malformed, cycle, and integration tests.

### Changed

- JPEG parser records internal fill-aware rewrite ranges while retaining existing public source offsets.
- Parse-limit validation is shared by inspection and cleaning.

### Foundation

- Repository and TypeScript library scaffold.
- Public API skeleton.
- Security and architecture documentation.
