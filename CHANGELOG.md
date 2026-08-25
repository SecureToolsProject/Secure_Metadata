# Changelog

All notable changes will be documented here. The project intends to follow semantic versioning once releases begin.

## Unreleased

### Added

- Reproducible fast-check properties for arbitrary-byte inspection, parser mutations, subview isolation, limits, cleaners, and fail-closed verification.
- Finite public-API fuzz harness with explicit seed, iteration, input-size, target, and counterexample-path replay controls.
- Deterministic 250-iteration fuzz smoke coverage in CI and documented regression-promotion workflow.

- Deterministic malformed-input corpus for generic bytes, JPEG, WebP, PNG, and shared TIFF corruption families.
- Cross-format invariants for deterministic inspection and cleaning, native-exception containment, fail-closed operations, input immutability, and cheap limit stress.
- Testing and fuzz-readiness guidance with future property and fuzz targets; random fuzzing remains outside normal CI.

- Bounded PNG chunk parsing with chunk-count, IEND, trailing-data, type, range, CRC-field, and compact CRC-32 validation.
- PNG text, exact XMP `iTXt`, `eXIf`, ICC, timestamp, rendering/color, APNG, and unknown ancillary classification.
- Shared TIFF/EXIF field decoding for exact bounded PNG `eXIf` data views.
- Deterministic PNG Privacy Clean and verification with single-allocation reconstruction and byte-identical retained chunks, CRCs, IDAT/APNG data, and trailing bytes.

- Bounded WebP RIFF/chunk parsing with declared-size, padding, VP8X, and chunk-count validation.
- WebP EXIF, XMP, and ICCP container inspection with image/alpha/animation distinction.
- Deterministic WebP Privacy Clean with RIFF-size and VP8X metadata-flag repair.
- WebP metadata verification, ICC/unknown preservation, and canonical malformed/padding coverage.
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

- Normalized cleaning defaults and deprecated ICC alias precedence through one immutable semantic policy across JPEG, WebP, and PNG.
- Verification now omits not-applicable format concepts and fails closed when metadata-entry limits truncate reporting.
- Aligned metadata-entry, diagnostic, status, ICC-classification, and source-order invariants across supported formats.

### Fixed

- Enforced `maxMetadataEntries` within a single TIFF IFD and across normalized public metadata reports.
- Enforced `maxDiagnostics` while container/TIFF diagnostics are emitted and in typed incomplete-cleaner errors.
- Kept WebP structural failure state independent from capped diagnostic storage.
- Removed unreachable foundation-era `NotImplementedError` and unused diagnostic codes.

### Foundation

- Repository and TypeScript library scaffold.
- Public API skeleton.
- Security and architecture documentation.
