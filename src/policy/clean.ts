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
import { preservedOrientationExifPayload } from "../exif/orientation.js";
import { inspectMetadata } from "../inspect.js";
import { parseJpeg } from "../jpeg/parser.js";
import type { JpegSegment } from "../jpeg/types.js";
import {
  DEFAULT_CLEANING_POLICY,
  normalizeCleaningPolicy,
  type NormalizedCleaningPolicy,
} from "./normalize.js";
import { cleanPng } from "../png/clean.js";
import { cleanWebP } from "../webp/clean.js";

export const DEFAULT_JPEG_CLEANING_POLICY = DEFAULT_CLEANING_POLICY;

function shouldRemove(
  segment: JpegSegment,
  policy: NormalizedCleaningPolicy,
): boolean {
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

interface SegmentEdit {
  readonly segment: JpegSegment;
  readonly replacement?: Uint8Array;
}

function jpegApp1Segment(payload: Uint8Array): Uint8Array {
  const declaredLength = payload.byteLength + 2;
  if (declaredLength > 0xffff) {
    throw new SecureMetadataError(
      "Preserved EXIF Orientation exceeds the JPEG APP1 size limit.",
      "CLEAN_OUTPUT_SIZE_INVALID",
    );
  }
  const output = new Uint8Array(payload.byteLength + 4);
  output.set([0xff, 0xe1, declaredLength >>> 8, declaredLength & 0xff]);
  output.set(payload, 4);
  return output;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index])
  );
}

function copyWithSegmentEdits(
  input: Uint8Array,
  edits: readonly SegmentEdit[],
): Uint8Array {
  let inputOffset = 0;
  let outputLength = input.byteLength;

  for (const { segment, replacement } of edits) {
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
        "JPEG cleaner produced an invalid edit range.",
        "CLEAN_OUTPUT_SIZE_INVALID",
      );
    }
    outputLength += (replacement?.byteLength ?? 0) - segment.rangeLength;
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
    inputOffset = end;
  }

  const output = new Uint8Array(outputLength);
  inputOffset = 0;
  let outputOffset = 0;
  for (const { segment, replacement } of edits) {
    const retainedLength = segment.rangeOffset - inputOffset;
    output.set(input.subarray(inputOffset, segment.rangeOffset), outputOffset);
    outputOffset += retainedLength;
    if (replacement !== undefined) {
      output.set(replacement, outputOffset);
      outputOffset += replacement.byteLength;
    }
    inputOffset = segment.rangeOffset + segment.rangeLength;
  }
  output.set(input.subarray(inputOffset), outputOffset);
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
    resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics),
  );
  if (!jpeg.complete) {
    throw new IncompleteJpegError(
      "cleanMetadata",
      jpeg.diagnostics.slice(
        0,
        resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics),
      ),
    );
  }

  const resolved = normalizeCleaningPolicy(policy);
  const orientationCandidates = resolved.removeExif
    ? jpeg.segments.flatMap((segment) => {
        if (
          segment.metadataKind !== "exif" ||
          segment.payloadOffset === undefined ||
          segment.payloadLength === undefined
        ) {
          return [];
        }
        const payload = reader.slice(
          segment.payloadOffset,
          segment.payloadLength,
        );
        const replacement = preservedOrientationExifPayload(
          payload,
          policy?.limits,
        );
        return replacement === undefined ? [] : [{ segment, replacement }];
      })
    : [];
  const orientationCandidate =
    orientationCandidates.length === 1 ? orientationCandidates[0] : undefined;
  const edits: SegmentEdit[] = [];
  const orientationPreserved: MetadataChange[] = [];

  for (const segment of jpeg.segments) {
    if (!shouldRemove(segment, resolved)) {
      continue;
    }
    if (
      orientationCandidate !== undefined &&
      segment === orientationCandidate.segment
    ) {
      const replacement = jpegApp1Segment(orientationCandidate.replacement);
      orientationPreserved.push({
        ...changeFor(segment, "preserved"),
        name: "EXIF Orientation",
      });
      const original = bytes.subarray(
        segment.rangeOffset,
        segment.rangeOffset + segment.rangeLength,
      );
      if (!bytesEqual(original, replacement)) {
        edits.push({ segment, replacement });
      }
      continue;
    }
    edits.push({ segment });
  }

  const removed = edits.map(({ segment }) => changeFor(segment, "removed"));
  const preserved = [
    ...jpeg.segments
      .filter(
        (segment) =>
          (segment.kind === "application" || segment.kind === "comment") &&
          !shouldRemove(segment, resolved),
      )
      .map((segment) => changeFor(segment, "preserved")),
    ...orientationPreserved,
  ];
  const output = copyWithSegmentEdits(bytes, edits);
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
