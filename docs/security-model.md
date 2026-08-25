# Security Model

All binary input is attacker-controlled. The cross-format guarantees are:

1. bounded reads and checked range arithmetic;
2. advancing or terminating parser loops;
3. hard segment, chunk, IFD, entry, depth, string, diagnostic, and input limits;
4. no recursion over untrusted container structures;
5. no pixel decoding or image re-encoding;
6. no compressed metadata inflation;
7. safe whole-container removal when outer boundaries are trustworthy;
8. unknown metadata preservation by default;
9. ICC and rendering/color preservation by default;
10. deterministic, source-ordered output;
11. exactly one output re-inspection per cleaner;
12. observational verification without provenance or privacy claims.

`maxMetadataEntries` bounds processed TIFF work and normalized public entries. `maxDiagnostics` is enforced while JPEG, WebP, PNG, and TIFF diagnostics are emitted and again when reports are combined. `maxStringBytes` bounds TIFF values and PNG keyword extraction. `maxDecompressedBytes` is reserved and currently unused because no decompression exists.

## Format-specific reconstruction

JPEG requires trustworthy traversal through EOI and preserves retained marker, fill, scan, restart, and trailing bytes. WebP requires a complete RIFF/chunk boundary, preserves padding and trailing data, repairs RIFF size, and changes only applicable VP8X metadata flags. PNG requires a complete IEND boundary, preserves trailing data, and copies every retained length/type/data/CRC byte unchanged. Each reconstruction uses one final output allocation and honors the caller's exact `Uint8Array` view.

Malformed inner EXIF/TIFF or textual payloads do not block removal of their bounded JPEG segment, WebP chunk, or PNG chunk. Unsafe outer boundaries produce `IncompleteJpegError`, `IncompleteWebPError`, or `IncompletePngError` without partial output.

Verification reports only supported `present` or `absent` observations. Not-applicable format concepts produce no check. Truncated metadata reporting is recorded independently of diagnostic output, produces no checks, and fails verification. The library does not establish authenticity, provenance, absence of proprietary metadata, visible-person privacy, steganography safety, malware safety, or complete metadata absence.

Core production code has zero runtime dependencies and no network, analytics, telemetry, filesystem, DOM, Node `Buffer`, or required platform-global behavior.

## Malformed-input assurance

Malformed input is part of the expected threat model. A small deterministic corpus covers representative generic, JPEG, WebP, PNG, and TIFF structural corruption families, including truncation, corrupt lengths and offsets, cycles, and configured work limits. Parser loops must advance or terminate, and unsafe outer container boundaries cause typed fail-closed cleaning and verification errors before output is produced.

The corpus is regression coverage, not proof of parser correctness. No decompression is implemented, so decompression bombs are outside the current attack surface and `maxDecompressedBytes` remains reserved. Reproducible property testing and dedicated fuzzing are planned future layers; random fuzzing is not part of normal CI. See [testing and fuzz readiness](testing.md).
