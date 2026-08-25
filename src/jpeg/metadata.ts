import { type ByteReader } from "../core/binary/index.js";
import type { Diagnostic } from "../core/diagnostics.js";
import { DEFAULT_PARSE_LIMITS } from "../core/limits.js";
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
  readonly entryLimitExceeded: boolean;
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
  maxMetadataEntries: number,
): JpegMetadataInspection {
  const entries: MetadataEntry[] = [];
  const diagnostics: Diagnostic[] = [];
  let attemptedExifDecode = false;
  let entryLimitExceeded = false;

  const add = (entry: MetadataEntry): boolean => {
    if (entries.length >= maxMetadataEntries) {
      entryLimitExceeded = true;
      return false;
    }
    entries.push(entry);
    return true;
  };

  for (const segment of result.segments) {
    if (segment.marker === JPEG_MARKER.COM) {
      add({
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
        if (
          !add({
            id: `jpeg-exif-${String(segment.offset)}`,
            namespace: "exif",
            name: "EXIF container",
            category: "unknown",
            privacy: "potentially-sensitive",
            source: source(segment),
          }) ||
          segment.payloadOffset === undefined ||
          segment.payloadLength === undefined
        ) {
          break;
        }
        attemptedExifDecode = true;
        const tiffOffset = segment.payloadOffset + 6;
        const tiffLength = segment.payloadLength - 6;
        const tiff = parseTiff(reader.slice(tiffOffset, tiffLength), {
          ...tiffLimits,
          maxMetadataEntries: maxMetadataEntries - entries.length,
          maxDiagnostics:
            (tiffLimits.maxDiagnostics ?? DEFAULT_PARSE_LIMITS.maxDiagnostics) -
            diagnostics.length,
        });
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
        entryLimitExceeded ||= tiff.entryLimitExceeded === true;
        break;
      }
      case "xmp":
        add({
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
        add({
          id: `jpeg-icc-${String(segment.offset)}`,
          namespace: "icc",
          name: "ICC profile container",
          category: "color",
          privacy: "non-sensitive",
          source: source(segment),
        });
        break;
      case "iptc":
        add({
          id: `jpeg-iptc-${String(segment.offset)}`,
          namespace: "iptc",
          name: "Photoshop/IPTC container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(segment),
        });
        break;
    }
  }

  return {
    entries,
    diagnostics,
    attemptedExifDecode,
    entryLimitExceeded,
  };
}
