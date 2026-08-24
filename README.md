# secure-metadata

`secure-metadata` is a pre-release TypeScript library for deterministic, security-conscious inspection, cleaning, and verification of metadata in binary image formats. It is being built for privacy-first, entirely local use with no analytics, telemetry, network access, runtime CDN, or pixel decoding.

## Development status

The current implementation provides a bounded binary input core and signature-based JPEG, PNG, and WebP format detection. `inspectMetadata` returns an explicit `format-only` report; metadata decoding, cleaning, and verification are not implemented.

## Format status

JPEG is detected from `FF D8`, PNG from its complete eight-byte signature, and WebP from `RIFF` plus `WEBP` identifiers. Detection identifies a likely container only. It does not yet validate JPEG segments, PNG chunks, WebP RIFF sizes or chunks, or any metadata. See [format support](docs/format-support.md).

## Installation

The package is not published. Installation instructions will be added for the first pre-release.

## Public API

The top-level API is deliberately small:

```ts
import {
  cleanMetadata,
  inspectMetadata,
  verifyMetadata,
} from "secure-metadata";
```

`inspectMetadata` currently normalizes `Uint8Array | ArrayBuffer` input without copying it, enforces `maxInputBytes`, detects the container signature, and returns an empty-entry report marked `inspectionStatus: "format-only"`. That status means metadata has not been decoded; it does not claim metadata is absent.

`cleanMetadata` and `verifyMetadata` still throw a typed `NotImplementedError`. Node.js `Buffer` values work structurally as `Uint8Array` but are not part of the public contract.

## Security philosophy

Every byte is untrusted. Binary reads use centrally checked ranges, parser input views retain their original boundaries, and malformed or tiny inputs are ordinary data. Cleaning will preserve unknown structures and ICC/color information by default, and cleaner output will be independently inspectable. See the [security model](docs/security-model.md), [architecture](docs/architecture.md), and [cleaning policy](docs/cleaning-policy.md).

## Non-goals

The library does not perform image decoding or encoding, visual redaction, pixel-content privacy analysis, steganography detection, or malware scanning. Absence of decoded metadata is never proof that an image contains no private information.

## Secure Tools ecosystem

This is an independent open-source library in the broader Secure Tools ecosystem. It has its own package, lifecycle, and repository; future Secure Tools integration will use a pinned browser artifact rather than coupling application code to this repository.

## License

MIT. See [LICENSE](LICENSE).
