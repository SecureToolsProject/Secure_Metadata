# Release process

This document defines the `v0.1.0` release-candidate process. It does not authorize publishing, tagging, or creating a GitHub release during development.

## Candidate validation

Start from a clean commit on the intended release revision, with Node.js 24 and Chromium installed for Playwright. Run:

```sh
npm run release:check
```

The command performs a clean install; formatting, lint, type, unit/property, bounded fuzz, build, real-browser, package, license, and vulnerability checks; validates version consistency; then builds the release artifacts twice in detached clean worktrees and compares every output byte.

Outputs are written to ignored `release/`:

- `secure-metadata-0.1.0.tgz` — npm package;
- `secure-metadata-0.1.0.browser.js` — standalone browser ESM artifact;
- `SHA256SUMS` — version, source commit, filenames, and SHA-256 hashes.

Verify a transferred artifact set with `npm run release:verify`. `npm run package:audit` separately verifies the exact npm payload and imports the packed package through both public entry points.

The browser artifact is a same-origin deployment asset, not a CDN dependency. Pin it by filename and SHA-256, serve it with a JavaScript MIME type, and retain its source commit association from `SHA256SUMS`.

## Licensing

The published package has no runtime dependencies and the bundled JavaScript contains project source only. Dev tooling is audited by `npm run license:audit`; its accepted SPDX set is explicit in that script. No third-party NOTICE file is currently required. Re-run the audit and review bundled content whenever dependencies or build configuration change.

## Trusted Publishing

Before the first publication, an npm package owner must configure Trusted Publishing for this repository, the `publish.yml` workflow, and the `npm` GitHub environment. The workflow uses GitHub OIDC (`id-token: write`) and `npm publish --provenance`; it intentionally contains no long-lived npm token.

After merging an approved release commit:

1. confirm all required checks pass on the exact commit;
2. create the signed or annotated tag `v0.1.0` on that commit;
3. push the tag and review the publish workflow and npm provenance attestation;
4. create GitHub release notes from `CHANGELOG.md` and attach the independently verified files from `release/` if desired;
5. verify installation from npm and the same-origin browser artifact in a fresh consumer.

For subsequent releases, update `package.json` and both lockfile version fields together exactly once, and ensure the tag is exactly `v<package version>`.
