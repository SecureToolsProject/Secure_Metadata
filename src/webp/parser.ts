import { type ByteReader } from "../core/binary/index.js";
import type { Diagnostic, DiagnosticCode } from "../core/diagnostics.js";
import { DEFAULT_PARSE_LIMITS } from "../core/limits.js";
import {
  classifyWebPChunk,
  WEBP_VP8X_FLAG,
  WEBP_VP8X_METADATA_MASK,
} from "./chunks.js";
import type { WebPChunk, WebPParseResult } from "./types.js";

const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function diagnostic(
  severity: Diagnostic["severity"],
  code: DiagnosticCode,
  message: string,
  offset?: number,
): Diagnostic {
  return offset === undefined
    ? { severity, code, message }
    : { severity, code, message, offset };
}

function failure(
  diagnostics: readonly Diagnostic[],
  chunks: readonly WebPChunk[] = [],
  containerLength = 0,
): WebPParseResult {
  return { chunks, complete: false, containerLength, diagnostics };
}

function fourCC(reader: ByteReader, offset: number): string {
  return String.fromCharCode(
    reader.u8(offset),
    reader.u8(offset + 1),
    reader.u8(offset + 2),
    reader.u8(offset + 3),
  );
}

export function parseWebP(
  reader: ByteReader,
  maxChunks: number,
  maxDiagnostics = DEFAULT_PARSE_LIMITS.maxDiagnostics,
): WebPParseResult {
  const diagnostics: Diagnostic[] = [];
  const chunks: WebPChunk[] = [];
  let hasStructuralError = false;
  const addDiagnostic = (...items: readonly Diagnostic[]): void => {
    hasStructuralError ||= items.some(({ severity }) => severity === "error");
    const remaining = maxDiagnostics - diagnostics.length;
    if (remaining > 0) {
      diagnostics.push(...items.slice(0, remaining));
    }
  };

  if (
    !reader.has(0, 12) ||
    !reader.matches(0, RIFF) ||
    !reader.matches(8, WEBP)
  ) {
    addDiagnostic(
      diagnostic(
        "error",
        "WEBP_INVALID_RIFF_HEADER",
        "WebP input requires a 12-byte RIFF....WEBP header.",
        0,
      ),
    );
    return failure(diagnostics);
  }

  const declaredRiffSize = reader.u32LE(4);
  const containerLength = declaredRiffSize + 8;
  if (
    declaredRiffSize < 4 ||
    !Number.isSafeInteger(containerLength) ||
    containerLength < 12
  ) {
    addDiagnostic(
      diagnostic(
        "error",
        "WEBP_INVALID_RIFF_SIZE",
        "WebP RIFF size does not include the WEBP form type.",
        4,
      ),
    );
    return failure(diagnostics, chunks, containerLength);
  }
  if (containerLength > reader.length) {
    addDiagnostic(
      diagnostic(
        "error",
        "WEBP_TRUNCATED_RIFF",
        "WebP RIFF size extends beyond the supplied input.",
        4,
      ),
    );
    return failure(diagnostics, chunks, containerLength);
  }
  if (containerLength < reader.length) {
    addDiagnostic(
      diagnostic(
        "warning",
        "WEBP_TRAILING_DATA",
        `WebP contains ${String(reader.length - containerLength)} trailing byte(s) after the RIFF container.`,
        containerLength,
      ),
    );
  }

  let offset = 12;
  let vp8xCount = 0;
  while (offset < containerLength) {
    if (chunks.length >= maxChunks) {
      addDiagnostic(
        diagnostic(
          "error",
          "WEBP_CHUNK_LIMIT_EXCEEDED",
          `WebP chunk count exceeds maxChunks ${String(maxChunks)}.`,
          offset,
        ),
      );
      return failure(diagnostics, chunks, containerLength);
    }
    if (containerLength - offset < 8) {
      addDiagnostic(
        diagnostic(
          "error",
          "WEBP_TRUNCATED_CHUNK_HEADER",
          "WebP RIFF ends within a chunk header.",
          offset,
        ),
      );
      return failure(diagnostics, chunks, containerLength);
    }

    const type = fourCC(reader, offset);
    const payloadLength = reader.u32LE(offset + 4);
    const payloadOffset = offset + 8;
    const payloadEnd = payloadOffset + payloadLength;
    if (!Number.isSafeInteger(payloadEnd) || payloadEnd > containerLength) {
      addDiagnostic(
        diagnostic(
          "error",
          "WEBP_TRUNCATED_CHUNK",
          `${type} payload extends beyond the RIFF boundary.`,
          offset,
        ),
      );
      return failure(diagnostics, chunks, containerLength);
    }

    const padding = payloadLength % 2;
    if (padding === 1 && payloadEnd === containerLength) {
      addDiagnostic(
        diagnostic(
          "error",
          "WEBP_INVALID_PADDING",
          `${type} has an odd payload without its required padding byte.`,
          payloadEnd,
        ),
      );
      return failure(diagnostics, chunks, containerLength);
    }
    const totalLength = 8 + payloadLength + padding;
    if (
      !Number.isSafeInteger(totalLength) ||
      totalLength > containerLength - offset
    ) {
      addDiagnostic(
        diagnostic(
          "error",
          "WEBP_TRUNCATED_CHUNK",
          `${type} physical chunk range exceeds the RIFF boundary.`,
          offset,
        ),
      );
      return failure(diagnostics, chunks, containerLength);
    }

    const classification = classifyWebPChunk(type);
    let vp8xFlags: number | undefined;
    if (type === "VP8X") {
      vp8xCount += 1;
      if (vp8xCount > 1) {
        addDiagnostic(
          diagnostic(
            "error",
            "WEBP_DUPLICATE_VP8X",
            "WebP contains more than one VP8X chunk.",
            offset,
          ),
        );
      }
      if (payloadLength !== 10) {
        addDiagnostic(
          diagnostic(
            "error",
            "WEBP_INVALID_VP8X",
            "VP8X payload must be exactly 10 bytes.",
            offset,
          ),
        );
      } else {
        vp8xFlags = reader.u8(payloadOffset);
      }
    }

    chunks.push({
      fourCC: type,
      offset,
      payloadOffset,
      payloadLength,
      totalLength,
      ...classification,
      ...(vp8xFlags === undefined ? {} : { vp8xFlags }),
    });
    offset += totalLength;
  }

  const vp8x = chunks.find(({ fourCC: type }) => type === "VP8X");
  if (!hasStructuralError && vp8x?.vp8xFlags !== undefined) {
    const observedFlags =
      (chunks.some(({ metadataKind }) => metadataKind === "icc")
        ? WEBP_VP8X_FLAG.icc
        : 0) |
      (chunks.some(({ metadataKind }) => metadataKind === "exif")
        ? WEBP_VP8X_FLAG.exif
        : 0) |
      (chunks.some(({ metadataKind }) => metadataKind === "xmp")
        ? WEBP_VP8X_FLAG.xmp
        : 0);
    if ((vp8x.vp8xFlags & WEBP_VP8X_METADATA_MASK) !== observedFlags) {
      addDiagnostic(
        diagnostic(
          "warning",
          "WEBP_INCONSISTENT_FEATURE_FLAGS",
          "VP8X metadata flags do not match observed metadata chunks.",
          vp8x.payloadOffset,
        ),
      );
    }
  }

  return {
    chunks,
    complete: !hasStructuralError,
    containerLength,
    diagnostics,
  };
}
