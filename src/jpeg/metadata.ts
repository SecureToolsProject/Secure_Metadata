import { type ByteReader } from "../core/binary/index.js";
import type { Diagnostic } from "../core/diagnostics.js";
import type { MetadataEntry } from "../core/types.js";
import {
  metadataEntriesFromTiff,
  relocateTiffDiagnostics,
} from "../exif/metadata.js";
import { parseTiff, type TiffParseLimits } from "../exif/tiff.js";
import { JPEG_MARKER } from "./markers.js";
import type { JpegParseResult, JpegSegment } from "./types.js";

export interface JpegMetadataInspection {
  readonly entries: readonly MetadataEntry[];
  readonly diagnostics: readonly Diagnostic[];
  readonly attemptedExifDecode: boolean;
}

function source(segment: JpegSegment): MetadataEntry["source"] {
  return {
    format: "jpeg",
    container: "jpeg-segment",
    offset: segment.offset,
    length: segment.length,
    jpegMarker: segment.marker,
  };
}

export function inspectJpegMetadata(
  reader: ByteReader,
  result: JpegParseResult,
  tiffLimits: TiffParseLimits,
): JpegMetadataInspection {
  const entries: MetadataEntry[] = [];
  const diagnostics: Diagnostic[] = [];
  let attemptedExifDecode = false;

  for (const segment of result.segments) {
    if (segment.marker === JPEG_MARKER.COM) {
      entries.push({
        id: `jpeg-comment-${String(segment.offset)}`,
        namespace: "jpeg-comment",
        name: "JPEG comment",
        category: "description",
        privacy: "potentially-sensitive",
        source: source(segment),
      });
      continue;
    }

    switch (segment.metadataKind) {
      case "exif": {
        entries.push({
          id: `jpeg-exif-${String(segment.offset)}`,
          namespace: "exif",
          name: "EXIF container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(segment),
        });
        if (
          segment.payloadOffset === undefined ||
          segment.payloadLength === undefined
        ) {
          break;
        }
        attemptedExifDecode = true;
        const tiffOffset = segment.payloadOffset + 6;
        const tiffLength = segment.payloadLength - 6;
        const tiff = parseTiff(
          reader.slice(tiffOffset, tiffLength),
          tiffLimits,
        );
        entries.push(
          ...metadataEntriesFromTiff(tiff, {
            format: "jpeg",
            baseOffset: tiffOffset,
            idPrefix: `jpeg-tiff-${String(segment.offset)}`,
          }),
        );
        diagnostics.push(
          ...relocateTiffDiagnostics(tiff.diagnostics, tiffOffset),
        );
        break;
      }
      case "xmp":
        entries.push({
          id: `jpeg-xmp-${String(segment.offset)}`,
          namespace: "xmp",
          name:
            segment.metadataSubtype === "extended-xmp"
              ? "Extended XMP container"
              : "XMP container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(segment),
        });
        break;
      case "icc":
        entries.push({
          id: `jpeg-icc-${String(segment.offset)}`,
          namespace: "icc",
          name: "ICC profile container",
          category: "color",
          privacy: "non-sensitive",
          source: source(segment),
        });
        break;
      case "iptc":
        entries.push({
          id: `jpeg-iptc-${String(segment.offset)}`,
          namespace: "iptc",
          name: "Photoshop/IPTC container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(segment),
        });
        break;
      default:
        break;
    }
  }

  return { entries, diagnostics, attemptedExifDecode };
}
