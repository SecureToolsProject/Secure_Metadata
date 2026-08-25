import { type ByteReader } from "../core/binary/index.js";
import type { Diagnostic } from "../core/diagnostics.js";
import type { MetadataEntry } from "../core/types.js";
import {
  metadataEntriesFromTiff,
  relocateTiffDiagnostics,
} from "../exif/metadata.js";
import { parseTiff, type TiffParseLimits } from "../exif/tiff.js";
import type { PngChunk, PngParseResult } from "./types.js";

export interface PngMetadataInspection {
  readonly entries: readonly MetadataEntry[];
  readonly diagnostics: readonly Diagnostic[];
  readonly attemptedExifDecode: boolean;
}

function source(chunk: PngChunk): MetadataEntry["source"] {
  return {
    format: "png",
    container: "png-chunk",
    offset: chunk.offset,
    length: chunk.totalLength,
    chunkType: chunk.fourCC,
  };
}

export function inspectPngMetadata(
  reader: ByteReader,
  result: PngParseResult,
  tiffLimits: TiffParseLimits,
): PngMetadataInspection {
  const entries: MetadataEntry[] = [];
  const diagnostics: Diagnostic[] = [];
  let attemptedExifDecode = false;

  for (const chunk of result.chunks) {
    switch (chunk.metadataKind) {
      case "exif": {
        entries.push({
          id: `png-exif-${String(chunk.offset)}`,
          namespace: "exif",
          name: "PNG EXIF container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(chunk),
        });
        attemptedExifDecode = true;
        const tiff = parseTiff(
          reader.slice(chunk.dataOffset, chunk.dataLength),
          tiffLimits,
        );
        entries.push(
          ...metadataEntriesFromTiff(tiff, {
            format: "png",
            baseOffset: chunk.dataOffset,
            idPrefix: `png-tiff-${String(chunk.offset)}`,
          }),
        );
        diagnostics.push(
          ...relocateTiffDiagnostics(tiff.diagnostics, chunk.dataOffset),
        );
        break;
      }
      case "xmp":
        entries.push({
          id: `png-xmp-${String(chunk.offset)}`,
          namespace: "xmp",
          name: "PNG XMP iTXt container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(chunk),
        });
        break;
      case "text":
        entries.push({
          id: `png-text-${String(chunk.offset)}`,
          namespace: "png-text",
          name:
            chunk.keyword === undefined
              ? `${chunk.fourCC} metadata`
              : `${chunk.fourCC} metadata (${chunk.keyword})`,
          category: "description",
          privacy: "potentially-sensitive",
          source: source(chunk),
        });
        break;
      case "timestamp":
        entries.push({
          id: `png-time-${String(chunk.offset)}`,
          namespace: "png-time",
          name: "PNG modification time",
          category: "timestamp",
          privacy: "potentially-sensitive",
          source: source(chunk),
        });
        break;
      case "icc":
        entries.push({
          id: `png-icc-${String(chunk.offset)}`,
          namespace: "icc",
          name: "PNG ICC profile container",
          category: "color",
          privacy: "non-sensitive",
          source: source(chunk),
        });
        break;
    }
  }

  return { entries, diagnostics, attemptedExifDecode };
}
