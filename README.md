# secure-metadata

`secure-metadata` is a pre-release TypeScript library for deterministic, security-conscious inspection, cleaning, and verification of metadata in binary image formats. It is being built for privacy-first, entirely local use with no analytics, telemetry, network access, runtime CDN, or pixel decoding.

> **Development status:** Sprint 0 establishes the repository and API foundation. JPEG, PNG, WebP, EXIF, TIFF, XMP, IPTC, and ICC parsing and all cleaning behavior are not implemented yet.

## Format status

JPEG, WebP, and PNG are planned, in that order. See [format support](docs/format-support.md) for the intended progression.

## Installation

The package is not published. Installation instructions will be added for the first pre-release.

## Public API

The future top-level API is deliberately small:

```ts
import {
  cleanMetadata,
  inspectMetadata,
  verifyMetadata,
} from "secure-metadata";
```

All three functions currently throw a typed `NotImplementedError`. Public binary inputs are `Uint8Array | ArrayBuffer`; Node.js `Buffer` values work structurally as `Uint8Array` but are not part of the public contract.

## Security philosophy

Every byte is untrusted. Future binary reads will use bounded primitives, traversal will have hard limits, and malformed input must not crash a parser. Cleaning will preserve unknown structures and ICC/color information by default, and cleaner output will be independently inspectable. See the [security model](docs/security-model.md), [architecture](docs/architecture.md), and [cleaning policy](docs/cleaning-policy.md).

## Non-goals

The library does not perform image decoding or encoding, visual redaction, pixel-content privacy analysis, steganography detection, or malware scanning. Absence of metadata is never proof that an image contains no private information.

## Secure Tools ecosystem

This is an independent open-source library in the broader Secure Tools ecosystem. It has its own package, lifecycle, and repository; future Secure Tools integration will use a pinned browser artifact rather than coupling application code to this repository.

## License

MIT. See [LICENSE](LICENSE).
