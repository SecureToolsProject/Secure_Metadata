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

export function inspectMetadata(
  input: BinaryInput,
  options?: InspectOptions,
): MetadataReport {
  const bytes = toUint8Array(input);
  const maxInputBytes =
    options?.limits?.maxInputBytes ?? DEFAULT_PARSE_LIMITS.maxInputBytes;

  if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 0) {
    throw new InvalidParseLimitError("maxInputBytes", maxInputBytes);
  }

  if (bytes.byteLength > maxInputBytes) {
    throw new InputLimitExceededError(bytes.byteLength, maxInputBytes);
  }

  return {
    format: detectFormat(new ByteReader(bytes)),
    size: bytes.byteLength,
    inspectionStatus: "format-only",
    entries: [],
    diagnostics: [],
  };
}
