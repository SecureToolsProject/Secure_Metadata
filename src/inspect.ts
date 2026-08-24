import { ByteReader, toUint8Array } from "./core/binary/index.js";
import { detectFormat } from "./core/detect-format.js";
import {
  InputLimitExceededError,
  InvalidParseLimitError,
} from "./core/errors.js";
import { DEFAULT_PARSE_LIMITS } from "./core/limits.js";
import type {
  BinaryInput,
  InspectOptions,
  MetadataReport,
} from "./core/types.js";
import { jpegMetadataEntries } from "./jpeg/metadata.js";
import { parseJpeg } from "./jpeg/parser.js";

function effectiveLimit(
  name: "maxInputBytes" | "maxSegments",
  configured: number | undefined,
): number {
  const value = configured ?? DEFAULT_PARSE_LIMITS[name];
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidParseLimitError(name, value);
  }
  return value;
}

export function inspectMetadata(
  input: BinaryInput,
  options?: InspectOptions,
): MetadataReport {
  const bytes = toUint8Array(input);
  const maxInputBytes = effectiveLimit(
    "maxInputBytes",
    options?.limits?.maxInputBytes,
  );

  if (bytes.byteLength > maxInputBytes) {
    throw new InputLimitExceededError(bytes.byteLength, maxInputBytes);
  }

  const reader = new ByteReader(bytes);
  const format = detectFormat(reader);
  if (format === "jpeg") {
    const maxSegments = effectiveLimit(
      "maxSegments",
      options?.limits?.maxSegments,
    );
    const jpeg = parseJpeg(reader, maxSegments);
    return {
      format,
      size: bytes.byteLength,
      inspectionStatus: jpeg.complete
        ? "container-inspected"
        : "container-partial",
      entries: jpegMetadataEntries(jpeg),
      diagnostics: jpeg.diagnostics,
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
