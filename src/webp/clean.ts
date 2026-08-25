import { ByteReader } from "../core/binary/index.js";
import { IncompleteWebPError, SecureMetadataError } from "../core/errors.js";
import { resolveParseLimit } from "../core/limits.js";
import type {
  CleaningPolicy,
  CleanResult,
  MetadataChange,
  MetadataNamespace,
} from "../core/types.js";
import { inspectMetadata } from "../inspect.js";
import { WEBP_VP8X_FLAG, WEBP_VP8X_METADATA_MASK } from "./chunks.js";
import { parseWebP } from "./parser.js";
import type { WebPChunk } from "./types.js";

export const DEFAULT_WEBP_CLEANING_POLICY = Object.freeze({
  removeExif: true,
  removeXmp: true,
  preserveIcc: true,
});

interface EffectivePolicy {
  readonly removeExif: boolean;
  readonly removeXmp: boolean;
  readonly preserveIcc: boolean;
}

function effectivePolicy(policy: CleaningPolicy | undefined): EffectivePolicy {
  return {
    removeExif: policy?.removeExif ?? true,
    removeXmp: policy?.removeXmp ?? true,
    preserveIcc: policy?.preserveIcc ?? policy?.preserveColorProfiles ?? true,
  };
}

function shouldRemove(chunk: WebPChunk, policy: EffectivePolicy): boolean {
  switch (chunk.metadataKind) {
    case "exif":
      return policy.removeExif;
    case "xmp":
      return policy.removeXmp;
    case "icc":
      return !policy.preserveIcc;
    default:
      return false;
  }
}

function changeFor(
  chunk: WebPChunk,
  action: MetadataChange["action"],
): MetadataChange {
  let namespace: MetadataNamespace = "unknown";
  let name = `Unknown ${chunk.fourCC} chunk`;
  if (chunk.metadataKind !== undefined) {
    namespace = chunk.metadataKind;
    name =
      chunk.metadataKind === "icc"
        ? "WebP ICC profile container"
        : `WebP ${chunk.metadataKind.toUpperCase()} container`;
  }

  return {
    namespace,
    action,
    name,
    source: {
      format: "webp",
      container: "webp-chunk",
      offset: chunk.offset,
      length: chunk.totalLength,
      chunkType: chunk.fourCC,
    },
  };
}

function outputError(message: string): SecureMetadataError {
  return new SecureMetadataError(message, "CLEAN_OUTPUT_SIZE_INVALID");
}

export function cleanWebP(
  bytes: Uint8Array,
  policy?: CleaningPolicy,
): CleanResult {
  const parsed = parseWebP(
    new ByteReader(bytes),
    resolveParseLimit("maxChunks", policy?.limits?.maxChunks),
  );
  if (!parsed.complete) {
    throw new IncompleteWebPError("cleanMetadata", parsed.diagnostics);
  }

  const resolved = effectivePolicy(policy);
  const removals = parsed.chunks.filter((chunk) =>
    shouldRemove(chunk, resolved),
  );
  const retained = parsed.chunks.filter(
    (chunk) => !shouldRemove(chunk, resolved),
  );
  let containerLength = 12;
  for (const chunk of retained) {
    containerLength += chunk.totalLength;
    if (
      !Number.isSafeInteger(containerLength) ||
      containerLength > parsed.containerLength
    ) {
      throw outputError("WebP cleaner output RIFF size is invalid.");
    }
  }

  const trailingLength = bytes.byteLength - parsed.containerLength;
  const outputLength = containerLength + trailingLength;
  if (
    !Number.isSafeInteger(outputLength) ||
    outputLength < 12 ||
    outputLength > bytes.byteLength
  ) {
    throw outputError("WebP cleaner output size is invalid.");
  }

  const hasIcc = retained.some(({ metadataKind }) => metadataKind === "icc");
  const hasExif = retained.some(({ metadataKind }) => metadataKind === "exif");
  const hasXmp = retained.some(({ metadataKind }) => metadataKind === "xmp");
  const metadataFlags =
    (hasIcc ? WEBP_VP8X_FLAG.icc : 0) |
    (hasExif ? WEBP_VP8X_FLAG.exif : 0) |
    (hasXmp ? WEBP_VP8X_FLAG.xmp : 0);

  const output = new Uint8Array(outputLength);
  output.set(bytes.subarray(0, 12));
  new DataView(output.buffer).setUint32(4, containerLength - 8, true);
  let outputOffset = 12;
  for (const chunk of retained) {
    output.set(
      bytes.subarray(chunk.offset, chunk.offset + chunk.totalLength),
      outputOffset,
    );
    if (chunk.vp8xFlags !== undefined) {
      output[outputOffset + 8] =
        (chunk.vp8xFlags & ~WEBP_VP8X_METADATA_MASK) | metadataFlags;
    }
    outputOffset += chunk.totalLength;
  }
  output.set(bytes.subarray(parsed.containerLength), outputOffset);

  const report = inspectMetadata(
    output,
    policy?.limits === undefined ? undefined : { limits: policy.limits },
  );
  if (report.inspectionStatus === "container-partial") {
    throw new IncompleteWebPError("cleanMetadata", report.diagnostics);
  }

  return {
    output,
    format: "webp",
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
