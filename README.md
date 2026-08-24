# secure-metadata

`secure-metadata` is a pre-release TypeScript library for deterministic, security-conscious inspection, cleaning, and verification of metadata in binary image formats. It is built for privacy-first, entirely local use with no analytics, telemetry, network access, runtime CDN, or pixel decoding.

## Development status

Current implementation:

- bounded binary input and endian-aware read core;
- JPEG, PNG, and WebP signature detection;
- bounded JPEG marker, segment, and entropy-scan traversal;
- JPEG EXIF, XMP, ICC, Photoshop/IPTC, and comment container detection;
- shared little- and big-endian TIFF/EXIF decoder;
- iterative IFD0, ExifIFD, GPSIFD, and next-IFD traversal with cycle and depth protection;
- common TIFF, EXIF, and GPS field decoding with exact rational values;
- deterministic whole-segment JPEG Privacy Clean with byte-preserving reconstruction;
- structured JPEG verification for observable container presence or absence.

Not implemented: MakerNote or thumbnail decoding, XMP/IPTC/ICC payload parsing, PNG/WebP container parsing or cleaning, and PNG/WebP verification.

## Format status

JPEG reports can be `container-inspected`, `container-partial`, or `metadata-partial`. `metadata-partial` means supported TIFF/EXIF fields were attempted while the wider metadata space remains intentionally incomplete. PNG and WebP remain `format-only`. See [format support](docs/format-support.md).

## Installation

The package is not published. Installation instructions will be added for the first pre-release.

## Public API

```ts
import {
  cleanMetadata,
  inspectMetadata,
  verifyMetadata,
} from "secure-metadata";
```

`inspectMetadata` accepts `Uint8Array | ArrayBuffer`, enforces relevant parser limits, and returns deterministic normalized entries. JPEG EXIF reports retain the EXIF container entry and add decoded child entries with exact TIFF tag, type, count, source offset, and path information.

GPS rational components remain exact numerator/denominator pairs; decimal coordinates are not derived. Unknown TIFF tags and MakerNote are represented structurally without dumping or recursively parsing their payloads.

`cleanMetadata` supports JPEG. Its default policy removes complete EXIF, standard/extended XMP, Photoshop/IPTC, and COM segments while preserving ICC, JFIF/JFXX, Adobe APP14, unknown APP segments, structural data, scan bytes, and trailing bytes. It returns a separate output, container-level change evidence, and an inspection report of that output.

`verifyMetadata` supports JPEG expectations of `absent`, `present`, or `ignore` for EXIF, XMP, IPTC, comments, and ICC. The default checks the four privacy-clean removal targets. A single-file verification can observe presence or absence; it cannot prove that bytes came from an original file.

## Security philosophy

Every byte is untrusted. All offsets are interpreted within bounded views, traversal is iterative and limited, repeated IFD offsets are rejected, and malformed entries recover without unchecked access. Unknown JPEG APP structures remain unknown and are preserved by cleaning. See the [security model](docs/security-model.md), [architecture](docs/architecture.md), and [cleaning policy](docs/cleaning-policy.md).

## Non-goals

The library does not perform image decoding or encoding, visual redaction, pixel-content privacy analysis, steganography detection, or malware scanning. Absence of recognized or decoded metadata is never proof that an image contains no private information.

## Secure Tools ecosystem

This is an independent open-source library in the broader Secure Tools ecosystem. Future integration will use a pinned browser artifact rather than coupling application code to this repository.

## License

MIT. See [LICENSE](LICENSE).
