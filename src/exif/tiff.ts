import { ByteReader } from "../core/binary/index.js";
import type { Diagnostic, DiagnosticCode } from "../core/diagnostics.js";
import { DEFAULT_PARSE_LIMITS } from "../core/limits.js";
import { decodeTiffValue } from "./decode-value.js";
import { TIFF_FIELD_TYPE, tiffFieldTypeSize } from "./field-types.js";
import { TIFF_TAG, tiffTagDefinition } from "./tags.js";
import { TiffReader, type TiffByteOrder } from "./tiff-reader.js";
import type {
  TiffDecodedEntry,
  TiffIfdKind,
  TiffParseResult,
} from "./types.js";

export interface TiffParseLimits {
  readonly maxIfdEntries: number;
  readonly maxIfdDepth: number;
  readonly maxMetadataEntries: number;
  readonly maxStringBytes: number;
  readonly maxDiagnostics?: number;
}

interface PendingIfd {
  readonly offset: number;
  readonly kind: TiffIfdKind;
  readonly path: string;
  readonly depth: number;
}

interface TiffState {
  readonly entries: TiffDecodedEntry[];
  readonly diagnostics: Diagnostic[];
  complete: boolean;
  processedEntries: number;
  traversalLimitReported: boolean;
  readonly maxDiagnostics: number;
}

function checkedMultiply(left: number, right: number): number | undefined {
  return left <= Math.floor(Number.MAX_SAFE_INTEGER / right)
    ? left * right
    : undefined;
}

function emit(
  state: TiffState,
  code: DiagnosticCode,
  message: string,
  offset?: number,
  severity: Diagnostic["severity"] = "error",
): void {
  if (state.diagnostics.length < state.maxDiagnostics) {
    state.diagnostics.push(
      offset === undefined
        ? { severity, code, message }
        : { severity, code, message, offset },
    );
  }
  if (severity === "error") {
    state.complete = false;
  }
}

function initialFailure(
  code: DiagnosticCode,
  message: string,
  maxDiagnostics: number,
  offset?: number,
): TiffParseResult {
  const diagnostic: Diagnostic =
    offset === undefined
      ? { severity: "error", code, message }
      : { severity: "error", code, message, offset };
  return {
    complete: false,
    entries: [],
    diagnostics: maxDiagnostics === 0 ? [] : [diagnostic],
  };
}

function byteOrder(bytes: ByteReader): TiffByteOrder | undefined {
  if (bytes.matches(0, [0x49, 0x49])) {
    return "little";
  }
  if (bytes.matches(0, [0x4d, 0x4d])) {
    return "big";
  }
  return undefined;
}

function queueTarget(
  reader: TiffReader,
  state: TiffState,
  pending: PendingIfd[],
  target: number,
  kind: TiffIfdKind,
  path: string,
  depth: number,
  sourceOffset: number,
  maxTargets: number,
): void {
  if (target === 0) {
    return;
  }
  if (!reader.has(target, 2)) {
    emit(
      state,
      "TIFF_INVALID_POINTER",
      `TIFF ${path} pointer targets an invalid IFD offset ${String(target)}.`,
      sourceOffset,
    );
    return;
  }
  if (pending.length >= maxTargets) {
    if (!state.traversalLimitReported) {
      emit(
        state,
        "TIFF_TRAVERSAL_LIMIT_EXCEEDED",
        `TIFF traversal exceeds maxMetadataEntries ${String(maxTargets)}.`,
        sourceOffset,
      );
      state.traversalLimitReported = true;
    }
    return;
  }
  pending.push({ offset: target, kind, path, depth });
}

export function parseTiff(
  bytes: Uint8Array,
  limits: TiffParseLimits,
): TiffParseResult {
  const maxDiagnostics =
    limits.maxDiagnostics ?? DEFAULT_PARSE_LIMITS.maxDiagnostics;
  const raw = new ByteReader(bytes);
  if (!raw.has(0, 8)) {
    return initialFailure(
      "TIFF_TRUNCATED_HEADER",
      "TIFF header requires at least eight bytes.",
      maxDiagnostics,
      0,
    );
  }

  const order = byteOrder(raw);
  if (order === undefined) {
    return initialFailure(
      "TIFF_INVALID_BYTE_ORDER",
      "TIFF byte order must be II or MM.",
      maxDiagnostics,
      0,
    );
  }

  const reader = new TiffReader(bytes, order);
  if (reader.u16(2) !== 42) {
    return {
      byteOrder: order,
      complete: false,
      entries: [],
      diagnostics:
        maxDiagnostics === 0
          ? []
          : [
              {
                severity: "error",
                code: "TIFF_INVALID_MAGIC",
                message: "TIFF magic value is not 42.",
                offset: 2,
              },
            ],
    };
  }

  const firstIfdOffset = reader.u32(4);
  if (firstIfdOffset === 0) {
    return {
      byteOrder: order,
      complete: true,
      entries: [],
      diagnostics: [],
    };
  }
  if (!reader.has(firstIfdOffset, 2)) {
    return {
      byteOrder: order,
      complete: false,
      entries: [],
      diagnostics:
        maxDiagnostics === 0
          ? []
          : [
              {
                severity: "error",
                code: "TIFF_INVALID_FIRST_IFD_OFFSET",
                message: "TIFF first IFD offset is outside the TIFF payload.",
                offset: 4,
              },
            ],
    };
  }

  const state: TiffState = {
    entries: [],
    diagnostics: [],
    complete: true,
    processedEntries: 0,
    traversalLimitReported: false,
    maxDiagnostics,
  };
  const pending: PendingIfd[] = [
    { offset: firstIfdOffset, kind: "ifd0", path: "IFD0", depth: 1 },
  ];
  const visited = new Set<number>();
  let queueIndex = 0;

  while (queueIndex < pending.length) {
    const current = pending[queueIndex];
    queueIndex += 1;
    if (current === undefined) {
      break;
    }

    if (visited.has(current.offset)) {
      emit(
        state,
        "TIFF_CYCLIC_IFD",
        `TIFF IFD offset ${String(current.offset)} was already visited.`,
        current.offset,
      );
      continue;
    }
    if (current.depth > limits.maxIfdDepth) {
      emit(
        state,
        "TIFF_IFD_DEPTH_LIMIT_EXCEEDED",
        `TIFF IFD depth exceeds maxIfdDepth ${String(limits.maxIfdDepth)}.`,
        current.offset,
      );
      continue;
    }
    visited.add(current.offset);

    const entryCount = reader.u16(current.offset);
    if (entryCount > limits.maxIfdEntries) {
      emit(
        state,
        "TIFF_IFD_ENTRY_LIMIT_EXCEEDED",
        `TIFF IFD declares ${String(entryCount)} entries, exceeding maxIfdEntries ${String(limits.maxIfdEntries)}.`,
        current.offset,
      );
      continue;
    }

    const entriesByteLength = checkedMultiply(entryCount, 12);
    if (entriesByteLength === undefined) {
      emit(
        state,
        "TIFF_TRUNCATED_IFD",
        "TIFF IFD table size exceeds safe integer arithmetic.",
        current.offset,
      );
      continue;
    }
    const tableLength = 2 + entriesByteLength + 4;
    if (!reader.has(current.offset, tableLength)) {
      emit(
        state,
        "TIFF_TRUNCATED_IFD",
        "TIFF IFD table or next-IFD pointer is truncated.",
        current.offset,
      );
      continue;
    }

    const exifTargets: Array<{ target: number; sourceOffset: number }> = [];
    const gpsTargets: Array<{ target: number; sourceOffset: number }> = [];
    const entriesOffset = current.offset + 2;

    for (let index = 0; index < entryCount; index += 1) {
      if (state.processedEntries >= limits.maxMetadataEntries) {
        if (!state.traversalLimitReported) {
          emit(
            state,
            "TIFF_TRAVERSAL_LIMIT_EXCEEDED",
            `TIFF traversal exceeds maxMetadataEntries ${String(limits.maxMetadataEntries)}.`,
            entriesOffset + index * 12,
          );
          state.traversalLimitReported = true;
        }
        break;
      }
      state.processedEntries += 1;
      const entryOffset = entriesOffset + index * 12;
      const tag = reader.u16(entryOffset);
      const type = reader.u16(entryOffset + 2);
      const count = reader.u32(entryOffset + 4);
      const valueFieldOffset = entryOffset + 8;
      const definition = tiffTagDefinition(current.kind, tag);
      const typeSize = tiffFieldTypeSize(type);

      if (typeSize === undefined) {
        emit(
          state,
          "TIFF_UNSUPPORTED_FIELD_TYPE",
          `${definition.name} uses unsupported TIFF field type ${String(type)}.`,
          entryOffset + 2,
        );
        state.entries.push({
          tag,
          type,
          count,
          name: definition.name,
          namespace: definition.namespace,
          category: definition.category,
          privacy: definition.privacy,
          path: `${current.path}/${definition.name}`,
          entryOffset,
          valueOffset: valueFieldOffset,
          valueLength: 0,
        });
        continue;
      }

      const valueByteLength = checkedMultiply(count, typeSize);
      if (
        valueByteLength === undefined ||
        valueByteLength > limits.maxStringBytes
      ) {
        emit(
          state,
          "TIFF_INVALID_VALUE_RANGE",
          `${definition.name} value size is outside configured decoding limits.`,
          entryOffset,
        );
        state.entries.push({
          tag,
          type,
          count,
          name: definition.name,
          namespace: definition.namespace,
          category: definition.category,
          privacy: definition.privacy,
          path: `${current.path}/${definition.name}`,
          entryOffset,
          valueOffset: valueFieldOffset,
          valueLength: valueByteLength ?? 0,
        });
        continue;
      }

      const valueOffset =
        valueByteLength <= 4 ? valueFieldOffset : reader.u32(valueFieldOffset);
      if (!reader.has(valueOffset, valueByteLength)) {
        emit(
          state,
          "TIFF_INVALID_VALUE_OFFSET",
          `${definition.name} value range is outside the TIFF payload.`,
          valueFieldOffset,
        );
        state.entries.push({
          tag,
          type,
          count,
          name: definition.name,
          namespace: definition.namespace,
          category: definition.category,
          privacy: definition.privacy,
          path: `${current.path}/${definition.name}`,
          entryOffset,
          valueOffset,
          valueLength: valueByteLength,
        });
        continue;
      }

      if (
        tag === TIFF_TAG.EXIF_IFD_POINTER ||
        tag === TIFF_TAG.GPS_IFD_POINTER
      ) {
        if (type !== TIFF_FIELD_TYPE.LONG || count !== 1) {
          emit(
            state,
            "TIFF_INVALID_POINTER",
            `${definition.name} must be LONG with count 1.`,
            entryOffset,
          );
          continue;
        }
        const target = reader.u32(valueOffset);
        const collection =
          tag === TIFF_TAG.EXIF_IFD_POINTER ? exifTargets : gpsTargets;
        collection.push({ target, sourceOffset: valueFieldOffset });
        continue;
      }

      const isOpaque =
        definition.name === "MakerNote" || definition.name.startsWith("Tag0x");
      const decoded = isOpaque
        ? { diagnostics: [] as readonly Diagnostic[] }
        : decodeTiffValue(reader, type, count, valueOffset, definition);
      for (const item of decoded.diagnostics) {
        if (state.diagnostics.length < state.maxDiagnostics) {
          state.diagnostics.push(item);
        }
        if (item.severity === "error") {
          state.complete = false;
        }
      }
      state.entries.push({
        tag,
        type,
        count,
        name: definition.name,
        namespace: definition.namespace,
        category: definition.category,
        privacy: definition.privacy,
        ...(decoded.value === undefined ? {} : { value: decoded.value }),
        path: `${current.path}/${definition.name}`,
        entryOffset,
        valueOffset,
        valueLength: valueByteLength,
      });
    }

    const nextPointerOffset = entriesOffset + entriesByteLength;
    const nextTarget = reader.u32(nextPointerOffset);
    for (const target of exifTargets) {
      queueTarget(
        reader,
        state,
        pending,
        target.target,
        "exif",
        `${current.path}/ExifIFD`,
        current.depth + 1,
        target.sourceOffset,
        limits.maxMetadataEntries,
      );
    }
    for (const target of gpsTargets) {
      queueTarget(
        reader,
        state,
        pending,
        target.target,
        "gps",
        `${current.path}/GPSIFD`,
        current.depth + 1,
        target.sourceOffset,
        limits.maxMetadataEntries,
      );
    }
    queueTarget(
      reader,
      state,
      pending,
      nextTarget,
      "next",
      current.kind === "ifd0" ? "IFD1" : `${current.path}/NextIFD`,
      current.depth + 1,
      nextPointerOffset,
      limits.maxMetadataEntries,
    );
  }

  return {
    byteOrder: order,
    complete: state.complete,
    entries: state.entries,
    diagnostics: state.diagnostics,
    ...(state.traversalLimitReported
      ? { entryLimitExceeded: true as const }
      : {}),
  };
}
