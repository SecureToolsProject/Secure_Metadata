# secure-metadata

`secure-metadata` is a pre-1.0 TypeScript library for deterministic, security-conscious inspection, cleaning, and verification of metadata in binary image formats. It is built for privacy-first, entirely local use with no analytics, telemetry, network access, runtime CDN, or pixel decoding.

## Development status

Current implementation:

- bounded binary input and endian-aware read core;
- JPEG inspection, common TIFF/EXIF decoding, Orientation-preserving Privacy Clean, and verification;
- WebP RIFF/chunk inspection, EXIF/XMP/ICC container detection, Privacy Clean, and verification;
- PNG chunk inspection with text, XMP, EXIF, ICC, timestamp, rendering, and APNG classification;
- shared TIFF/EXIF decoding for JPEG EXIF and PNG `eXIf` payloads;
- deterministic PNG Privacy Clean and verification with retained chunks and CRC bytes preserved exactly;
- iterative IFD0, ExifIFD, GPSIFD, and next-IFD traversal with cycle and depth protection.

Not implemented: MakerNote or thumbnail decoding, XMP/IPTC/ICC payload parsing, WebP EXIF field decoding, compressed PNG text or ICC decompression, and image/pixel decoding.

## Format status

JPEG supports bounded inspection, common TIFF/EXIF field decoding, cleaning, and verification. WebP supports bounded RIFF/chunk inspection and container-level cleaning and verification. PNG supports bounded chunk inspection, direct shared-TIFF decoding of `eXIf`, container-level cleaning, and verification. Compressed `zTXt`, compressed `iTXt`, and `iCCP` payloads remain opaque. See [format support](docs/format-support.md).

## Installation

The package is not currently published to npm. Source and release artifacts for `v0.1.0` are available from the [GitHub release](https://github.com/SecureToolsProject/Secure_Metadata/releases/tag/v0.1.0).

Node.js 20 or newer is required. Browser consumers can verify the released version, license, and SHA-256 checksum, then vendor the standalone browser artifact on the same origin. The library never loads code from a CDN.

## Public API

```ts
import {
  cleanMetadata,
  inspectMetadata,
  verifyMetadata,
} from "secure-metadata";
```

`inspectMetadata` accepts `Uint8Array | ArrayBuffer`, enforces relevant parser limits, and returns deterministic normalized entries. JPEG and PNG EXIF reports retain the EXIF container entry and add decoded child entries with exact TIFF tag, type, count, source offset, and path information.

GPS rational components remain exact numerator/denominator pairs; decimal coordinates are not derived. Unknown TIFF tags and MakerNote are represented structurally without dumping or recursively parsing their payloads.

`DEFAULT_CLEANING_POLICY` is the authoritative semantic default: remove recognized private EXIF, XMP, IPTC, comments, ordinary text, and standalone timestamps; preserve ICC, unknown, rendering, and image data. For JPEG only, a single valid IFD0 Orientation value from 1 through 8 is rewritten into canonical Orientation-only EXIF so display rotation survives cleaning; all other EXIF fields are removed. Each format maps only applicable concepts to physical containers. The deprecated `preserveColorProfiles` alias is used only when explicit `preserveIcc` is absent.

`verifyMetadata` supports `absent`, `present`, or `ignore` expectations. Concepts not implemented for a format produce no check rather than implying an exhaustive search. Verification fails closed if metadata reporting reaches its configured entry limit. Single-file verification observes supported container presence or absence and cannot prove provenance or pixel privacy.

## Generated testing

The deterministic corpus is supplemented by fixed-seed property tests and a finite public-API fuzz harness. CI runs only the bounded smoke profile; extended local runs remain explicitly iteration- and input-size-limited. See the [testing model](docs/testing.md) for replay and regression-promotion commands.

## Security philosophy

Every byte is untrusted. All offsets are interpreted within bounded views, traversal is iterative and limited, and malformed structures fail without unchecked access. PNG image data and compressed metadata are never inflated. Unknown JPEG APP segments, WebP chunks, and PNG ancillary chunks are preserved by default. See the [security model](docs/security-model.md), [architecture](docs/architecture.md), [testing model](docs/testing.md), [cleaning policy](docs/cleaning-policy.md), [v0.1 API contract](docs/api-contract.md), and [release process](docs/releasing.md).

## Non-goals

The library does not perform image decoding or encoding, visual redaction, pixel-content privacy analysis, steganography detection, or malware scanning. Absence of recognized or decoded metadata is never proof that an image contains no private information.

## Secure Tools ecosystem

This is an independent open-source library in the broader Secure Tools ecosystem. Secure Tools should upgrade its vendored browser artifact to `v0.1.1` after that release is published, verify the version, license, and SHA-256 checksum, and continue serving the pinned artifact from the same origin rather than coupling application code to this repository.

## License

MIT. See [LICENSE](LICENSE).
