import { ByteReader, toUint8Array } from "./core/binary/index.js";
import { detectFormat } from "./core/detect-format.js";
import type { Diagnostic } from "./core/diagnostics.js";
import { InputLimitExceededError } from "./core/errors.js";
import { DEFAULT_PARSE_LIMITS, resolveParseLimit } from "./core/limits.js";
import type { ParseLimits } from "./core/limits.js";
import type {
  BinaryInput,
  InspectOptions,
  MetadataReport,
} from "./core/types.js";
import type { TiffParseLimits } from "./exif/tiff.js";
import { inspectJpegMetadata } from "./jpeg/metadata.js";
import { parseJpeg } from "./jpeg/parser.js";
import { inspectPngMetadata } from "./png/metadata.js";
import { parsePng } from "./png/parser.js";
import { inspectWebPMetadata } from "./webp/metadata.js";
import { parseWebP } from "./webp/parser.js";

function resolveTiffLimits(
  limits: Partial<ParseLimits> | undefined,
  enabled: boolean,
): TiffParseLimits {
  return {
    maxIfdEntries: enabled
      ? resolveParseLimit("maxIfdEntries", limits?.maxIfdEntries)
      : DEFAULT_PARSE_LIMITS.maxIfdEntries,
    maxIfdDepth: enabled
      ? resolveParseLimit("maxIfdDepth", limits?.maxIfdDepth)
      : DEFAULT_PARSE_LIMITS.maxIfdDepth,
    maxMetadataEntries: enabled
      ? resolveParseLimit("maxMetadataEntries", limits?.maxMetadataEntries)
      : DEFAULT_PARSE_LIMITS.maxMetadataEntries,
    maxStringBytes: enabled
      ? resolveParseLimit("maxStringBytes", limits?.maxStringBytes)
      : DEFAULT_PARSE_LIMITS.maxStringBytes,
    maxDiagnostics: enabled
      ? resolveParseLimit("maxDiagnostics", limits?.maxDiagnostics)
      : DEFAULT_PARSE_LIMITS.maxDiagnostics,
  };
}

function boundedDiagnostics(
  diagnostics: readonly Diagnostic[],
  entryLimitExceeded: boolean,
  maxDiagnostics: number,
): readonly Diagnostic[] {
  const withEntryLimit = entryLimitExceeded
    ? [
        {
          severity: "warning" as const,
          code: "METADATA_ENTRY_LIMIT_EXCEEDED" as const,
          message:
            "Metadata report exceeds the configured maxMetadataEntries limit.",
        },
        ...diagnostics,
      ]
    : diagnostics;
  return withEntryLimit.slice(0, maxDiagnostics);
}

export function inspectMetadata(
  input: BinaryInput,
  options?: InspectOptions,
): MetadataReport {
  const bytes = toUint8Array(input);
  const maxInputBytes = resolveParseLimit(
    "maxInputBytes",
    options?.limits?.maxInputBytes,
  );

  if (bytes.byteLength > maxInputBytes) {
    throw new InputLimitExceededError(bytes.byteLength, maxInputBytes);
  }

  const reader = new ByteReader(bytes);
  const format = detectFormat(reader);
  if (format === "jpeg") {
    const maxMetadataEntries = resolveParseLimit(
      "maxMetadataEntries",
      options?.limits?.maxMetadataEntries,
    );
    const maxDiagnostics = resolveParseLimit(
      "maxDiagnostics",
      options?.limits?.maxDiagnostics,
    );
    const jpeg = parseJpeg(
      reader,
      resolveParseLimit("maxSegments", options?.limits?.maxSegments),
      maxDiagnostics,
    );
    const hasExif = jpeg.segments.some(
      ({ metadataKind }) => metadataKind === "exif",
    );
    const metadata = inspectJpegMetadata(
      reader,
      jpeg,
      resolveTiffLimits(options?.limits, hasExif),
      maxMetadataEntries,
    );
    return {
      format,
      size: bytes.byteLength,
      inspectionStatus: !jpeg.complete
        ? "container-partial"
        : metadata.attemptedExifDecode
          ? "metadata-partial"
          : "container-inspected",
      entries: metadata.entries,
      ...(metadata.entryLimitExceeded
        ? { metadataTruncated: true as const }
        : {}),
      diagnostics: boundedDiagnostics(
        [...jpeg.diagnostics, ...metadata.diagnostics],
        metadata.entryLimitExceeded,
        maxDiagnostics,
      ),
    };
  }

  if (format === "webp") {
    const maxMetadataEntries = resolveParseLimit(
      "maxMetadataEntries",
      options?.limits?.maxMetadataEntries,
    );
    const maxDiagnostics = resolveParseLimit(
      "maxDiagnostics",
      options?.limits?.maxDiagnostics,
    );
    const webp = parseWebP(
      reader,
      resolveParseLimit("maxChunks", options?.limits?.maxChunks),
      maxDiagnostics,
    );
    const metadata = inspectWebPMetadata(webp, maxMetadataEntries);
    return {
      format,
      size: bytes.byteLength,
      inspectionStatus: webp.complete
        ? "container-inspected"
        : "container-partial",
      entries: metadata.entries,
      ...(metadata.entryLimitExceeded
        ? { metadataTruncated: true as const }
        : {}),
      diagnostics: boundedDiagnostics(
        webp.diagnostics,
        metadata.entryLimitExceeded,
        maxDiagnostics,
      ),
    };
  }

  if (format === "png") {
    const maxMetadataEntries = resolveParseLimit(
      "maxMetadataEntries",
      options?.limits?.maxMetadataEntries,
    );
    const maxDiagnostics = resolveParseLimit(
      "maxDiagnostics",
      options?.limits?.maxDiagnostics,
    );
    const png = parsePng(
      reader,
      resolveParseLimit("maxChunks", options?.limits?.maxChunks),
      resolveParseLimit("maxStringBytes", options?.limits?.maxStringBytes),
      maxDiagnostics,
    );
    const hasExif = png.chunks.some(
      ({ metadataKind }) => metadataKind === "exif",
    );
    const metadata = inspectPngMetadata(
      reader,
      png,
      resolveTiffLimits(options?.limits, hasExif),
      maxMetadataEntries,
    );
    return {
      format,
      size: bytes.byteLength,
      inspectionStatus: !png.complete
        ? "container-partial"
        : metadata.attemptedExifDecode
          ? "metadata-partial"
          : "container-inspected",
      entries: metadata.entries,
      ...(metadata.entryLimitExceeded
        ? { metadataTruncated: true as const }
        : {}),
      diagnostics: boundedDiagnostics(
        [...png.diagnostics, ...metadata.diagnostics],
        metadata.entryLimitExceeded,
        maxDiagnostics,
      ),
    };
  }

  return {
    format,
    size: bytes.byteLength,
    inspectionStatus: "format-only",
    entries: [],
    diagnostics: [],
  };
}
