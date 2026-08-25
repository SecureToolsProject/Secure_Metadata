import type { MetadataEntry } from "../core/types.js";
import type { WebPParseResult } from "./types.js";

export interface WebPMetadataInspection {
  readonly entries: readonly MetadataEntry[];
  readonly entryLimitExceeded: boolean;
}

export function inspectWebPMetadata(
  result: WebPParseResult,
  maxMetadataEntries: number,
): WebPMetadataInspection {
  const entries: MetadataEntry[] = [];
  let entryLimitExceeded = false;

  for (const chunk of result.chunks) {
    if (chunk.metadataKind === undefined) {
      continue;
    }
    if (entries.length >= maxMetadataEntries) {
      entryLimitExceeded = true;
      continue;
    }

    const source = {
      format: "webp" as const,
      container: "webp-chunk" as const,
      offset: chunk.offset,
      length: chunk.totalLength,
      chunkType: chunk.fourCC,
    };
    switch (chunk.metadataKind) {
      case "exif":
        entries.push({
          id: `webp-exif-${String(chunk.offset)}`,
          namespace: "exif",
          name: "WebP EXIF container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source,
        });
        break;
      case "xmp":
        entries.push({
          id: `webp-xmp-${String(chunk.offset)}`,
          namespace: "xmp",
          name: "WebP XMP container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source,
        });
        break;
      case "icc":
        entries.push({
          id: `webp-icc-${String(chunk.offset)}`,
          namespace: "icc",
          name: "WebP ICC profile container",
          category: "color",
          privacy: "non-sensitive",
          source,
        });
        break;
    }
  }

  return { entries, entryLimitExceeded };
}
