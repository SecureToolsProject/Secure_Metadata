# Security Model

All binary input is attacker-controlled. The cross-format guarantees are:

1. bounded reads and checked range arithmetic;
2. advancing or terminating parser loops;
3. hard segment, chunk, IFD, entry, depth, string, diagnostic, and input limits;
4. no recursion over untrusted container structures;
5. no pixel decoding or image re-encoding;
6. no compressed metadata inflation;
7. safe whole-container removal when outer boundaries are trustworthy, with a bounded canonical rewrite only for one valid JPEG Orientation;
8. unknown metadata preservation by default;
9. ICC and rendering/color preservation by default;
10. deterministic, source-ordered output;
11. exactly one output re-inspection per cleaner;
12. observational verification without provenance or privacy claims.

`maxMetadataEntries` bounds processed TIFF work and normalized public entries. `maxDiagnostics` is enforced while JPEG, WebP, PNG, and TIFF diagnostics are emitted and again when reports are combined. `maxStringBytes` bounds TIFF values and PNG keyword extraction. `maxDecompressedBytes` is reserved and currently unused because no decompression exists.

## Format-specific reconstruction

JPEG requires trustworthy traversal through EOI and preserves retained marker, fill, scan, restart, and trailing bytes. When exactly one EXIF APP1 contains a fully decoded IFD0 Orientation SHORT/count-1 value from 1 through 8, the cleaner replaces that segment with a minimal TIFF structure preserving the original byte order and value. It never rotates or re-encodes pixels. Multiple, malformed, incomplete, limited, or conflicting candidates are removed rather than interpreted. WebP requires a complete RIFF/chunk boundary, preserves padding and trailing data, repairs RIFF size, and changes only applicable VP8X metadata flags. PNG requires a complete IEND boundary, preserves trailing data, and copies every retained length/type/data/CRC byte unchanged. Each reconstruction uses one final output allocation and honors the caller's exact `Uint8Array` view.

Malformed inner EXIF/TIFF or textual payloads do not block removal of their bounded JPEG segment, WebP chunk, or PNG chunk. Unsafe outer boundaries produce `IncompleteJpegError`, `IncompleteWebPError`, or `IncompletePngError` without partial output.

Verification reports only supported `present` or `absent` observations. Canonical Orientation-only JPEG EXIF is an explicit rendering exception to the default EXIF privacy-absence check; any additional EXIF or GPS entry makes EXIF present. Not-applicable format concepts produce no check. Truncated metadata reporting is recorded independently of diagnostic output, produces no checks, and fails verification. The library does not establish authenticity, provenance, absence of proprietary metadata, visible-person privacy, steganography safety, malware safety, or complete metadata absence.

Core production code has zero runtime dependencies and no network, analytics, telemetry, filesystem, DOM, Node `Buffer`, or required platform-global behavior.

## Malformed-input assurance

Malformed input is part of the expected threat model. A small deterministic corpus covers representative generic, JPEG, WebP, PNG, and TIFF structural corruption families, including truncation, corrupt lengths and offsets, cycles, and configured work limits. Parser loops must advance or terminate, and unsafe outer container boundaries cause typed fail-closed cleaning and verification errors before output is produced.

The corpus, fixed-seed property tests, and finite public-API fuzz harness improve regression confidence but are not proof of parser correctness or security. Current protections still come from bounded readers, checked arithmetic, explicit traversal limits, deterministic parser progress, and fail-closed cleaning. No decompression is implemented, so decompression bombs are outside the current attack surface and `maxDecompressedBytes` remains reserved. Normal CI runs only a bounded deterministic fuzz smoke profile; extended local runs remain finite. See [testing and fuzz readiness](testing.md).
