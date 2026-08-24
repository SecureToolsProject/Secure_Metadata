# Security Policy

## Supported versions

`secure-metadata` is pre-release software and currently has no supported release line. A supported-version table will be added before the first public release.

## Reporting a vulnerability

Binary parser vulnerabilities should be coordinated privately before public disclosure. If GitHub private vulnerability reporting is enabled for this repository, use **Security → Report a vulnerability**. Do not include a malicious sample or parser details in a public issue.

If private vulnerability reporting is not available, there is not yet a dedicated reporting channel. Maintainers must configure one before the first public release; do not invent or guess a contact address.

Please include the affected revision, impact, reproduction steps, and the smallest safe test case you can provide. Parser crashes, incorrect or out-of-bounds-style offset logic, unbounded traversal or allocation, and resource exhaustion are security-relevant.

## Threat model

All input bytes are treated as malicious. The library is designed to inspect container and metadata structures without decoding pixels, touching the filesystem, or using the network. Hard limits and bounded reads are core defenses, while cleaner output must be independently parsed and verified.
