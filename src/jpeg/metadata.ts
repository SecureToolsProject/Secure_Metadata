import type { MetadataEntry } from "../core/types.js";
import { JPEG_MARKER } from "./markers.js";
import type { JpegParseResult, JpegSegment } from "./types.js";

function source(segment: JpegSegment): MetadataEntry["source"] {
  return {
    format: "jpeg",
    container: "jpeg-segment",
    offset: segment.offset,
    length: segment.length,
    jpegMarker: segment.marker,
  };
}

export function jpegMetadataEntries(
  result: JpegParseResult,
): readonly MetadataEntry[] {
  const entries: MetadataEntry[] = [];

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
      case "exif":
        entries.push({
          id: `jpeg-exif-${String(segment.offset)}`,
          namespace: "exif",
          name: "EXIF container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(segment),
        });
        break;
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

  return entries;
}
