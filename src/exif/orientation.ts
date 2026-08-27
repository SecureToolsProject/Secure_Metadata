import { resolveParseLimit } from "../core/limits.js";
import type { ParseLimits } from "../core/limits.js";
import { TIFF_FIELD_TYPE } from "./field-types.js";
import { parseTiff } from "./tiff.js";
import { TIFF_TAG } from "./tags.js";
import type { TiffByteOrder } from "./tiff-reader.js";
import type { TiffParseResult } from "./types.js";

const EXIF_SIGNATURE = Uint8Array.of(0x45, 0x78, 0x69, 0x66, 0x00, 0x00);
const TIFF_LENGTH = 26;

export interface ExifOrientation {
  readonly value: number;
  readonly byteOrder: TiffByteOrder;
}

function matches(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index])
  );
}

function parseLimits(limits: Partial<ParseLimits> | undefined) {
  return {
    maxIfdEntries: resolveParseLimit("maxIfdEntries", limits?.maxIfdEntries),
    maxIfdDepth: resolveParseLimit("maxIfdDepth", limits?.maxIfdDepth),
    maxMetadataEntries: resolveParseLimit(
      "maxMetadataEntries",
      limits?.maxMetadataEntries,
    ),
    maxStringBytes: resolveParseLimit("maxStringBytes", limits?.maxStringBytes),
    maxDiagnostics: resolveParseLimit("maxDiagnostics", limits?.maxDiagnostics),
  };
}

export function orientationFromTiff(
  result: TiffParseResult,
): ExifOrientation | undefined {
  if (
    !result.complete ||
    result.entryLimitExceeded === true ||
    result.byteOrder === undefined
  ) {
    return undefined;
  }

  const orientations = result.entries.filter(
    (entry) =>
      entry.tag === TIFF_TAG.ORIENTATION && entry.path === "IFD0/Orientation",
  );
  const orientation = orientations[0];
  if (
    orientations.length !== 1 ||
    orientation === undefined ||
    orientation.type !== TIFF_FIELD_TYPE.SHORT ||
    orientation.count !== 1 ||
    typeof orientation.value !== "number" ||
    orientation.value < 1 ||
    orientation.value > 8
  ) {
    return undefined;
  }

  return { value: orientation.value, byteOrder: result.byteOrder };
}

export function minimalOrientationExifPayload(
  orientation: ExifOrientation,
): Uint8Array {
  const output = new Uint8Array(EXIF_SIGNATURE.byteLength + TIFF_LENGTH);
  output.set(EXIF_SIGNATURE);
  const tiffOffset = EXIF_SIGNATURE.byteLength;
  const view = new DataView(
    output.buffer,
    output.byteOffset + tiffOffset,
    TIFF_LENGTH,
  );
  const little = orientation.byteOrder === "little";
  output.set(little ? [0x49, 0x49] : [0x4d, 0x4d], tiffOffset);
  view.setUint16(2, 42, little);
  view.setUint32(4, 8, little);
  view.setUint16(8, 1, little);
  view.setUint16(10, TIFF_TAG.ORIENTATION, little);
  view.setUint16(12, TIFF_FIELD_TYPE.SHORT, little);
  view.setUint32(14, 1, little);
  view.setUint16(18, orientation.value, little);
  view.setUint32(22, 0, little);
  return output;
}

export function preservedOrientationExifPayload(
  payload: Uint8Array,
  limits?: Partial<ParseLimits>,
): Uint8Array | undefined {
  if (
    payload.byteLength < EXIF_SIGNATURE.byteLength ||
    !EXIF_SIGNATURE.every((value, index) => payload[index] === value)
  ) {
    return undefined;
  }
  const tiff = parseTiff(
    payload.subarray(EXIF_SIGNATURE.byteLength),
    parseLimits(limits),
  );
  const orientation = orientationFromTiff(tiff);
  return orientation === undefined
    ? undefined
    : minimalOrientationExifPayload(orientation);
}

export function isMinimalOrientationExifPayload(
  payload: Uint8Array,
  result: TiffParseResult,
): boolean {
  const orientation = orientationFromTiff(result);
  return (
    orientation !== undefined &&
    matches(payload, minimalOrientationExifPayload(orientation))
  );
}
