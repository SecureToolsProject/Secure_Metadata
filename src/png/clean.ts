import { ByteReader } from "../core/binary/index.js";
import { IncompletePngError, SecureMetadataError } from "../core/errors.js";
import { resolveParseLimit } from "../core/limits.js";
import type {
  CleaningPolicy,
  CleanResult,
  MetadataChange,
  MetadataNamespace,
} from "../core/types.js";
import { inspectMetadata } from "../inspect.js";
import {
  DEFAULT_CLEANING_POLICY,
  normalizeCleaningPolicy,
  type NormalizedCleaningPolicy,
} from "../policy/normalize.js";
import { parsePng } from "./parser.js";
import type { PngChunk } from "./types.js";

export const DEFAULT_PNG_CLEANING_POLICY = DEFAULT_CLEANING_POLICY;

function shouldRemove(
  chunk: PngChunk,
  policy: NormalizedCleaningPolicy,
): boolean {
  switch (chunk.metadataKind) {
    case "exif":
      return policy.removeExif;
    case "xmp":
      return policy.removeXmp;
    case "text":
      return policy.removeTextMetadata;
    case "timestamp":
      return policy.removeTimestamps;
    case "icc":
      return !policy.preserveIcc;
    default:
      return false;
  }
}

function changeFor(
  chunk: PngChunk,
  action: MetadataChange["action"],
): MetadataChange {
  let namespace: MetadataNamespace = "unknown";
  let name = `Unknown ${chunk.fourCC} chunk`;
  switch (chunk.metadataKind) {
    case "exif":
      namespace = "exif";
      name = "PNG EXIF container";
      break;
    case "xmp":
      namespace = "xmp";
      name = "PNG XMP iTXt container";
      break;
    case "text":
      namespace = "png-text";
      name = `${chunk.fourCC} metadata`;
      break;
    case "timestamp":
      namespace = "png-time";
      name = "PNG modification time";
      break;
    case "icc":
      namespace = "icc";
      name = "PNG ICC profile container";
      break;
  }

  return {
    namespace,
    action,
    name,
    source: {
      format: "png",
      container: "png-chunk",
      offset: chunk.offset,
      length: chunk.totalLength,
      chunkType: chunk.fourCC,
    },
  };
}

function outputError(message: string): SecureMetadataError {
  return new SecureMetadataError(message, "CLEAN_OUTPUT_SIZE_INVALID");
}

export function cleanPng(
  bytes: Uint8Array,
  policy?: CleaningPolicy,
): CleanResult {
  const parsed = parsePng(
    new ByteReader(bytes),
    resolveParseLimit("maxChunks", policy?.limits?.maxChunks),
    resolveParseLimit("maxStringBytes", policy?.limits?.maxStringBytes),
    resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics),
  );
  if (!parsed.complete) {
    throw new IncompletePngError(
      "cleanMetadata",
      parsed.diagnostics.slice(
        0,
        resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics),
      ),
    );
  }

  const resolved = normalizeCleaningPolicy(policy);
  const removals = parsed.chunks.filter((chunk) =>
    shouldRemove(chunk, resolved),
  );
  const retained = parsed.chunks.filter(
    (chunk) => !shouldRemove(chunk, resolved),
  );
  let containerLength = 8;
  for (const chunk of retained) {
    containerLength += chunk.totalLength;
    if (
      !Number.isSafeInteger(containerLength) ||
      containerLength > parsed.containerLength
    ) {
      throw outputError("PNG cleaner output container size is invalid.");
    }
  }

  const trailingLength = bytes.byteLength - parsed.containerLength;
  const outputLength = containerLength + trailingLength;
  if (
    !Number.isSafeInteger(outputLength) ||
    outputLength < 8 ||
    outputLength > bytes.byteLength
  ) {
    throw outputError("PNG cleaner output size is invalid.");
  }

  const output = new Uint8Array(outputLength);
  output.set(bytes.subarray(0, 8));
  let outputOffset = 8;
  for (const chunk of retained) {
    output.set(
      bytes.subarray(chunk.offset, chunk.offset + chunk.totalLength),
      outputOffset,
    );
    outputOffset += chunk.totalLength;
  }
  output.set(bytes.subarray(parsed.containerLength), outputOffset);

  const report = inspectMetadata(
    output,
    policy?.limits === undefined ? undefined : { limits: policy.limits },
  );
  if (report.inspectionStatus === "container-partial") {
    throw new IncompletePngError("cleanMetadata", report.diagnostics);
  }

  return {
    output,
    format: "png",
    report,
    removed: removals.map((chunk) => changeFor(chunk, "removed")),
    preserved: retained
      .filter(
        ({ kind, metadataKind }) =>
          kind === "unknown" || metadataKind !== undefined,
      )
      .map((chunk) => changeFor(chunk, "preserved")),
    diagnostics: report.diagnostics,
  };
}
