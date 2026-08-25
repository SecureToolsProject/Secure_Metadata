# v0.1 API contract

The `0.1.x` line freezes the package entry points `secure-metadata` and `secure-metadata/browser`. Both expose the same API; the browser entry points to the standalone ESM browser artifact and reuses the package declarations.

## Runtime exports

- operations: `inspectMetadata`, `cleanMetadata`, `verifyMetadata`;
- defaults: `DEFAULT_PARSE_LIMITS`, `DEFAULT_CLEANING_POLICY`, and the JPEG, WebP, and PNG cleaning and verification defaults;
- errors: `SecureMetadataError`, `BinaryBoundsError`, `IncompleteJpegError`, `IncompleteWebPError`, `IncompletePngError`, `InputLimitExceededError`, `InvalidParseLimitError`, and `UnsupportedFormatError`.

The exact 19-name runtime surface is enforced by `tests/release/public-api-contract.test.ts` and by installing the packed tarball into an isolated consumer.

## Type exports

The package exports the diagnostic, error-code, parsing-limit, binary-input, policy, result, report, metadata, rational, and verification types declared by `src/index.ts`. Type-only exports do not appear as JavaScript properties.

## Compatibility policy

Before `1.0.0`, minor releases may add API. Within `0.1.x`, removing or renaming an export, narrowing accepted inputs, changing documented result meaning, or changing default privacy policy requires a deliberate compatibility review and a version decision. Patch releases may fix incorrect behavior while preserving the documented contract.

This contract does not promise exhaustive metadata discovery. Unknown containers and opaque compressed payloads remain subject to the documented format and security limitations.
