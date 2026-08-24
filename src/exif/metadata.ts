import type { Diagnostic } from "../core/diagnostics.js";
import type { ImageFormat, MetadataEntry } from "../core/types.js";
import type { TiffParseResult } from "./types.js";

export interface TiffMetadataSourceContext {
  readonly format: ImageFormat;
  readonly baseOffset: number;
  readonly idPrefix: string;
}

export function metadataEntriesFromTiff(
  result: TiffParseResult,
  context: TiffMetadataSourceContext,
): readonly MetadataEntry[] {
  return result.entries.map((entry) => ({
    id: `${context.idPrefix}-${String(entry.entryOffset)}-${entry.tag.toString(16)}`,
    namespace: entry.namespace,
    name: entry.name,
    category: entry.category,
    privacy: entry.privacy,
    ...(entry.value === undefined ? {} : { value: entry.value }),
    source: {
      format: context.format,
      container: "tiff-ifd",
      offset: context.baseOffset + entry.entryOffset,
      length: 12,
      tiffPath: entry.path,
      tiffTag: entry.tag,
      tiffType: entry.type,
      tiffCount: entry.count,
    },
  }));
}

export function relocateTiffDiagnostics(
  diagnostics: readonly Diagnostic[],
  baseOffset: number,
): readonly Diagnostic[] {
  return diagnostics.map((item) =>
    item.offset === undefined
      ? item
      : { ...item, offset: baseOffset + item.offset },
  );
}
