import { ByteReader, toUint8Array } from "./core/binary/index.js";
import { detectFormat } from "./core/detect-format.js";
import { InputLimitExceededError } from "./core/errors.js";
import { DEFAULT_PARSE_LIMITS, resolveParseLimit } from "./core/limits.js";
import type {
  BinaryInput,
  InspectOptions,
  MetadataReport,
} from "./core/types.js";
import { inspectJpegMetadata } from "./jpeg/metadata.js";
import { parseJpeg } from "./jpeg/parser.js";
import { inspectWebPMetadata } from "./webp/metadata.js";
import { parseWebP } from "./webp/parser.js";

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
    const maxSegments = resolveParseLimit(
      "maxSegments",
      options?.limits?.maxSegments,
    );
    const jpeg = parseJpeg(reader, maxSegments);
    const hasExif = jpeg.segments.some(
      ({ metadataKind }) => metadataKind === "exif",
    );
    const tiffLimits = {
      maxIfdEntries: hasExif
        ? resolveParseLimit("maxIfdEntries", options?.limits?.maxIfdEntries)
        : DEFAULT_PARSE_LIMITS.maxIfdEntries,
      maxIfdDepth: hasExif
        ? resolveParseLimit("maxIfdDepth", options?.limits?.maxIfdDepth)
        : DEFAULT_PARSE_LIMITS.maxIfdDepth,
      maxMetadataEntries: hasExif
        ? resolveParseLimit(
            "maxMetadataEntries",
            options?.limits?.maxMetadataEntries,
          )
        : DEFAULT_PARSE_LIMITS.maxMetadataEntries,
      maxStringBytes: hasExif
        ? resolveParseLimit("maxStringBytes", options?.limits?.maxStringBytes)
        : DEFAULT_PARSE_LIMITS.maxStringBytes,
    };
    const metadata = inspectJpegMetadata(reader, jpeg, tiffLimits);
    return {
      format,
      size: bytes.byteLength,
      inspectionStatus: !jpeg.complete
        ? "container-partial"
        : metadata.attemptedExifDecode
          ? "metadata-partial"
          : "container-inspected",
      entries: metadata.entries,
      diagnostics: [...jpeg.diagnostics, ...metadata.diagnostics],
    };
  }

  if (format === "webp") {
    const webp = parseWebP(
      reader,
      resolveParseLimit("maxChunks", options?.limits?.maxChunks),
    );
    return {
      format,
      size: bytes.byteLength,
      inspectionStatus: webp.complete
        ? "container-inspected"
        : "container-partial",
      entries: inspectWebPMetadata(webp),
      diagnostics: webp.diagnostics,
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
