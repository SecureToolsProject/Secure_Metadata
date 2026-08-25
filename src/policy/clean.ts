import { ByteReader, toUint8Array } from "../core/binary/index.js";
import { detectFormat } from "../core/detect-format.js";
import {
  IncompleteJpegError,
  InputLimitExceededError,
  SecureMetadataError,
  UnsupportedFormatError,
} from "../core/errors.js";
import { resolveParseLimit } from "../core/limits.js";
import type {
  BinaryInput,
  CleaningPolicy,
  CleanResult,
  MetadataChange,
  MetadataNamespace,
} from "../core/types.js";
import { inspectMetadata } from "../inspect.js";
import { parseJpeg } from "../jpeg/parser.js";
import type { JpegSegment } from "../jpeg/types.js";
import { cleanPng } from "../png/clean.js";
import { cleanWebP } from "../webp/clean.js";

export const DEFAULT_JPEG_CLEANING_POLICY = Object.freeze({
  removeExif: true,
  removeXmp: true,
  removeIptc: true,
  removeComments: true,
  preserveIcc: true,
});

interface EffectivePolicy {
  readonly removeExif: boolean;
  readonly removeXmp: boolean;
  readonly removeIptc: boolean;
  readonly removeComments: boolean;
  readonly preserveIcc: boolean;
}

function effectivePolicy(policy: CleaningPolicy | undefined): EffectivePolicy {
  return {
    removeExif: policy?.removeExif ?? true,
    removeXmp: policy?.removeXmp ?? true,
    removeIptc: policy?.removeIptc ?? true,
    removeComments: policy?.removeComments ?? true,
    preserveIcc: policy?.preserveIcc ?? policy?.preserveColorProfiles ?? true,
  };
}

function shouldRemove(segment: JpegSegment, policy: EffectivePolicy): boolean {
  if (segment.kind === "comment") {
    return policy.removeComments;
  }

  switch (segment.metadataKind) {
    case "exif":
      return policy.removeExif;
    case "xmp":
      return policy.removeXmp;
    case "iptc":
      return policy.removeIptc;
    case "icc":
      return !policy.preserveIcc;
    default:
      return false;
  }
}

function changeFor(
  segment: JpegSegment,
  action: MetadataChange["action"],
): MetadataChange {
  let namespace: MetadataNamespace = "container";
  let name = segment.markerName;

  if (segment.kind === "comment") {
    namespace = "jpeg-comment";
    name = "JPEG comment";
  } else {
    switch (segment.metadataKind) {
      case "exif":
        namespace = "exif";
        name = "EXIF container";
        break;
      case "xmp":
        namespace = "xmp";
        name =
          segment.metadataSubtype === "extended-xmp"
            ? "Extended XMP container"
            : "XMP container";
        break;
      case "iptc":
        namespace = "iptc";
        name = "Photoshop/IPTC container";
        break;
      case "icc":
        namespace = "icc";
        name = "ICC profile container";
        break;
      case "jfif":
        name =
          segment.metadataSubtype === "jfxx"
            ? "JFXX application segment"
            : "JFIF application segment";
        break;
      case "adobe":
        name = "Adobe application segment";
        break;
      case "unknown":
        namespace = "unknown";
        name = `Unknown ${segment.markerName} application segment`;
        break;
    }
  }

  return {
    namespace,
    action,
    name,
    source: {
      format: "jpeg",
      container: "jpeg-segment",
      offset: segment.offset,
      length: segment.length,
      jpegMarker: segment.marker,
    },
  };
}

function copyWithoutSegments(
  input: Uint8Array,
  removals: readonly JpegSegment[],
): Uint8Array {
  const retained: Array<{ offset: number; length: number }> = [];
  let inputOffset = 0;
  let outputLength = 0;

  for (const segment of removals) {
    const end = segment.rangeOffset + segment.rangeLength;
    if (
      !Number.isSafeInteger(segment.rangeOffset) ||
      !Number.isSafeInteger(segment.rangeLength) ||
      segment.rangeLength <= 0 ||
      !Number.isSafeInteger(end) ||
      segment.rangeOffset < inputOffset ||
      end > input.byteLength
    ) {
      throw new SecureMetadataError(
        "JPEG cleaner produced an invalid removal range.",
        "CLEAN_OUTPUT_SIZE_INVALID",
      );
    }

    const length = segment.rangeOffset - inputOffset;
    retained.push({ offset: inputOffset, length });
    outputLength += length;
    if (
      !Number.isSafeInteger(outputLength) ||
      outputLength > input.byteLength
    ) {
      throw new SecureMetadataError(
        "JPEG cleaner output size is invalid.",
        "CLEAN_OUTPUT_SIZE_INVALID",
      );
    }
    inputOffset = end;
  }

  const tailLength = input.byteLength - inputOffset;
  retained.push({ offset: inputOffset, length: tailLength });
  outputLength += tailLength;
  if (
    !Number.isSafeInteger(outputLength) ||
    outputLength < 0 ||
    outputLength > input.byteLength
  ) {
    throw new SecureMetadataError(
      "JPEG cleaner output size is invalid.",
      "CLEAN_OUTPUT_SIZE_INVALID",
    );
  }

  const output = new Uint8Array(outputLength);
  let outputOffset = 0;
  for (const range of retained) {
    output.set(
      input.subarray(range.offset, range.offset + range.length),
      outputOffset,
    );
    outputOffset += range.length;
  }
  return output;
}

export function cleanMetadata(
  input: BinaryInput,
  policy?: CleaningPolicy,
): CleanResult {
  const bytes = toUint8Array(input);
  const maxInputBytes = resolveParseLimit(
    "maxInputBytes",
    policy?.limits?.maxInputBytes,
  );
  if (bytes.byteLength > maxInputBytes) {
    throw new InputLimitExceededError(bytes.byteLength, maxInputBytes);
  }

  const reader = new ByteReader(bytes);
  const format = detectFormat(reader);
  if (format === "png") {
    return cleanPng(bytes, policy);
  }
  if (format === "webp") {
    return cleanWebP(bytes, policy);
  }
  if (format !== "jpeg") {
    throw new UnsupportedFormatError("cleanMetadata", format);
  }

  const jpeg = parseJpeg(
    reader,
    resolveParseLimit("maxSegments", policy?.limits?.maxSegments),
  );
  if (!jpeg.complete) {
    throw new IncompleteJpegError("cleanMetadata", jpeg.diagnostics);
  }

  const resolved = effectivePolicy(policy);
  const removals = jpeg.segments.filter((segment) =>
    shouldRemove(segment, resolved),
  );
  const removed = removals.map((segment) => changeFor(segment, "removed"));
  const preserved = jpeg.segments
    .filter(
      (segment) =>
        (segment.kind === "application" || segment.kind === "comment") &&
        !shouldRemove(segment, resolved),
    )
    .map((segment) => changeFor(segment, "preserved"));
  const output = copyWithoutSegments(bytes, removals);
  const report = inspectMetadata(
    output,
    policy?.limits === undefined ? undefined : { limits: policy.limits },
  );
  if (report.inspectionStatus === "container-partial") {
    throw new IncompleteJpegError("cleanMetadata", report.diagnostics);
  }

  return {
    output,
    format: "jpeg",
    report,
    removed,
    preserved,
    diagnostics: report.diagnostics,
  };
}
