# Changelog

All notable changes will be documented here. The project intends to follow semantic versioning once releases begin.

## Unreleased

### Added

- Bounded JPEG marker and length-prefixed segment traversal.
- Standalone, fill-byte, restart-marker, EOI, and multi-scan handling.
- JPEG APP and COM container classification.
- EXIF, standard/extended XMP, ICC, Photoshop/IPTC, JFIF/JFXX, and Adobe presence detection.
- Structured malformed, truncation, trailing-data, and segment-limit diagnostics.
- Normalized JPEG metadata-container entries and complete/partial container status.
- Bounded binary reader, no-copy input normalization, and JPEG/PNG/WebP format detection.
- Binary boundary, sliced-view, format, malformed-input, and JPEG container tests.

### Foundation

- Repository and TypeScript library scaffold.
- Public API skeleton.
- Security and architecture documentation.
