# secure-metadata

`secure-metadata` is a pre-release TypeScript library for deterministic, security-conscious inspection, cleaning, and verification of metadata in binary image formats. It is built for privacy-first, entirely local use with no analytics, telemetry, network access, runtime CDN, or pixel decoding.

## Development status

Current implementation:

- bounded binary input and endian-aware read core;
- JPEG inspection, common TIFF/EXIF decoding, whole-segment Privacy Clean, and verification;
- WebP RIFF/chunk inspection, EXIF/XMP/ICC container detection, Privacy Clean, and verification;
- PNG chunk inspection with text, XMP, EXIF, ICC, timestamp, rendering, and APNG classification;
- shared TIFF/EXIF decoding for JPEG EXIF and PNG `eXIf` payloads;
- deterministic PNG Privacy Clean and verification with retained chunks and CRC bytes preserved exactly;
- iterative IFD0, ExifIFD, GPSIFD, and next-IFD traversal with cycle and depth protection.

Not implemented: MakerNote or thumbnail decoding, XMP/IPTC/ICC payload parsing, WebP EXIF field decoding, compressed PNG text or ICC decompression, and image/pixel decoding.

## Format status

JPEG supports bounded inspection, common TIFF/EXIF field decoding, cleaning, and verification. WebP supports bounded RIFF/chunk inspection and container-level cleaning and verification. PNG supports bounded chunk inspection, direct shared-TIFF decoding of `eXIf`, container-level cleaning, and verification. Compressed `zTXt`, compressed `iTXt`, and `iCCP` payloads remain opaque. See [format support](docs/format-support.md).

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

`inspectMetadata` accepts `Uint8Array | ArrayBuffer`, enforces relevant parser limits, and returns deterministic normalized entries. JPEG and PNG EXIF reports retain the EXIF container entry and add decoded child entries with exact TIFF tag, type, count, source offset, and path information.

GPS rational components remain exact numerator/denominator pairs; decimal coordinates are not derived. Unknown TIFF tags and MakerNote are represented structurally without dumping or recursively parsing their payloads.

`cleanMetadata` supports JPEG, WebP, and PNG. JPEG removes EXIF, XMP, Photoshop/IPTC, and comments. WebP removes EXIF and XMP while repairing RIFF size and applicable VP8X flags. PNG removes `eXIf`, XMP `iTXt`, ordinary `tEXt`/`zTXt`/`iTXt`, and `tIME`; it preserves `iCCP`, rendering/color chunks, image and APNG chunks, unknown chunks, critical chunks, and trailing bytes. All formats preserve ICC by default.

`verifyMetadata` supports `absent`, `present`, or `ignore` expectations. PNG defaults check EXIF, XMP, ordinary text, and timestamps, while ICC is ignored unless explicitly requested. Single-file verification observes supported container presence or absence and cannot prove provenance or pixel privacy.

## Security philosophy

Every byte is untrusted. All offsets are interpreted within bounded views, traversal is iterative and limited, and malformed structures fail without unchecked access. PNG image data and compressed metadata are never inflated. Unknown JPEG APP segments, WebP chunks, and PNG ancillary chunks are preserved by default. See the [security model](docs/security-model.md), [architecture](docs/architecture.md), and [cleaning policy](docs/cleaning-policy.md).

## Non-goals

The library does not perform image decoding or encoding, visual redaction, pixel-content privacy analysis, steganography detection, or malware scanning. Absence of recognized or decoded metadata is never proof that an image contains no private information.

## Secure Tools ecosystem

This is an independent open-source library in the broader Secure Tools ecosystem. Future integration will use a pinned browser artifact rather than coupling application code to this repository.

## License

MIT. See [LICENSE](LICENSE).
