import type { MetadataEntry } from "../core/types.js";
import type { WebPParseResult } from "./types.js";

export function inspectWebPMetadata(
  result: WebPParseResult,
): readonly MetadataEntry[] {
  return result.chunks.flatMap((chunk): readonly MetadataEntry[] => {
    const source = {
      format: "webp" as const,
      container: "webp-chunk" as const,
      offset: chunk.offset,
      length: chunk.totalLength,
      chunkType: chunk.fourCC,
    };

    switch (chunk.metadataKind) {
      case "exif":
        return [
          {
            id: `webp-exif-${String(chunk.offset)}`,
            namespace: "exif",
            name: "WebP EXIF container",
            category: "unknown",
            privacy: "potentially-sensitive",
            source,
          },
        ];
      case "xmp":
        return [
          {
            id: `webp-xmp-${String(chunk.offset)}`,
            namespace: "xmp",
            name: "WebP XMP container",
            category: "unknown",
            privacy: "potentially-sensitive",
            source,
          },
        ];
      case "icc":
        return [
          {
            id: `webp-icc-${String(chunk.offset)}`,
            namespace: "icc",
            name: "WebP ICC profile container",
            category: "color",
            privacy: "non-sensitive",
            source,
          },
        ];
      default:
        return [];
    }
  });
}
