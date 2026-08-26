# Security Policy

## Supported versions

| Version | Support                           |
| ------- | --------------------------------- |
| 0.1.x   | Supported through GitHub releases |
| < 0.1   | Not supported                     |

`v0.1.0` is published as a GitHub release. The package is not published to npm.

## Reporting a vulnerability

Binary parser vulnerabilities should be coordinated privately before public disclosure. Use **Security → Report a vulnerability** in this GitHub repository when private vulnerability reporting is available. Do not include a malicious sample or parser details in a public issue.

If private vulnerability reporting is unavailable, do not guess a maintainer address or open a public report containing exploit details. Repository owners must configure a private channel before publication.

Include the affected version and revision, impact, reproduction steps, and the smallest safe test case possible. Parser crashes, offset or bounds errors, unbounded traversal or allocation, resource exhaustion, cleaner verification failures, and unexpected network or filesystem behavior are security-relevant.

## Threat model

All input bytes are malicious. The library inspects container and recognized metadata structures without decoding pixels, accessing the filesystem, or using the network. Bounded reads, hard traversal and allocation limits, deterministic reconstruction, and independent output verification are core defenses.

The library does not decode image pixels, detect steganography or malware, prove provenance, or establish that an image is private. Unknown containers and opaque compressed metadata can remain. See [the security model](docs/security-model.md) and [format support](docs/format-support.md).
