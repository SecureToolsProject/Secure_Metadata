# secure-metadata

`secure-metadata` is a pre-release TypeScript library for deterministic, security-conscious inspection, cleaning, and verification of metadata in binary image formats. It is built for privacy-first, entirely local use with no analytics, telemetry, network access, runtime CDN, or pixel decoding.

## Development status

Current implementation:

- bounded binary input and endian-aware read core;
- JPEG, PNG, and WebP signature detection;
- bounded JPEG marker and segment traversal;
- JPEG entropy-scan skipping without image decoding;
- JPEG EXIF, XMP, extended XMP, ICC, Photoshop/IPTC, and comment container-presence detection.

Not implemented: TIFF/EXIF or GPS field decoding, XML/IPTC/ICC payload decoding, PNG/WebP container parsing, metadata cleaning, and verification.

## Format status

JPEG reports can be `container-inspected` or `container-partial`. PNG and WebP remain `format-only`. See [format support](docs/format-support.md) for the precise matrix.

A detected or traversed container is not necessarily a decodable image. The JPEG parser validates marker and segment boundaries, not quantization, Huffman, frame, scan-header, or entropy semantics.

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

`inspectMetadata` accepts `Uint8Array | ArrayBuffer`, enforces relevant parse limits, and returns a deterministic report. For JPEG it inventories the container and emits one normalized entry per recognized privacy/color metadata container. Entries identify container presence only; payload values are not decoded.

`cleanMetadata` and `verifyMetadata` still throw a typed `NotImplementedError`. Node.js `Buffer` values work structurally as `Uint8Array` but are not part of the public contract.

## Security philosophy

Every byte is untrusted. Binary reads use centrally checked ranges, parser input views retain their original boundaries, traversal is hard bounded, and malformed or tiny inputs are ordinary data. Unknown APP segments remain unknown and should be preserved by future cleaning. See the [security model](docs/security-model.md), [architecture](docs/architecture.md), and [cleaning policy](docs/cleaning-policy.md).

## Non-goals

The library does not perform image decoding or encoding, visual redaction, pixel-content privacy analysis, steganography detection, or malware scanning. Absence of recognized metadata containers is never proof that an image contains no private information.

## Secure Tools ecosystem

This is an independent open-source library in the broader Secure Tools ecosystem. It has its own package, lifecycle, and repository; future Secure Tools integration will use a pinned browser artifact rather than coupling application code to this repository.

## License

MIT. See [LICENSE](LICENSE).
