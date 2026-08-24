import { type ByteReader } from "../core/binary/index.js";
import { JPEG_MARKER } from "./markers.js";
import type {
  JpegMetadataKind,
  JpegMetadataSubtype,
  JpegSegmentKind,
} from "./types.js";

const JFIF_SIGNATURE = [0x4a, 0x46, 0x49, 0x46, 0x00];
const JFXX_SIGNATURE = [0x4a, 0x46, 0x58, 0x58, 0x00];
const EXIF_SIGNATURE = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
const XMP_SIGNATURE = [
  0x68, 0x74, 0x74, 0x70, 0x3a, 0x2f, 0x2f, 0x6e, 0x73, 0x2e, 0x61, 0x64, 0x6f,
  0x62, 0x65, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x78, 0x61, 0x70, 0x2f, 0x31, 0x2e,
  0x30, 0x2f, 0x00,
];
const EXTENDED_XMP_SIGNATURE = [
  0x68, 0x74, 0x74, 0x70, 0x3a, 0x2f, 0x2f, 0x6e, 0x73, 0x2e, 0x61, 0x64, 0x6f,
  0x62, 0x65, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x78, 0x6d, 0x70, 0x2f, 0x65, 0x78,
  0x74, 0x65, 0x6e, 0x73, 0x69, 0x6f, 0x6e, 0x2f, 0x00,
];
const ICC_SIGNATURE = [
  0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00,
];
const PHOTOSHOP_SIGNATURE = [
  0x50, 0x68, 0x6f, 0x74, 0x6f, 0x73, 0x68, 0x6f, 0x70, 0x20, 0x33, 0x2e, 0x30,
  0x00,
];
const ADOBE_SIGNATURE = [0x41, 0x64, 0x6f, 0x62, 0x65];

export interface JpegApplicationClassification {
  readonly metadataKind: JpegMetadataKind;
  readonly metadataSubtype?: JpegMetadataSubtype;
}

function matchesPayload(
  reader: ByteReader,
  payloadOffset: number,
  payloadLength: number,
  signature: readonly number[],
): boolean {
  return (
    signature.length <= payloadLength &&
    reader.matches(payloadOffset, signature)
  );
}

export function classifySegmentKind(marker: number): JpegSegmentKind {
  if (marker >= 0xe0 && marker <= 0xef) {
    return "application";
  }
  if (marker === JPEG_MARKER.COM) {
    return "comment";
  }
  if (marker === JPEG_MARKER.SOS) {
    return "scan";
  }
  if (
    marker === JPEG_MARKER.TEM ||
    marker === JPEG_MARKER.SOI ||
    marker === JPEG_MARKER.EOI ||
    (marker >= 0xd0 && marker <= 0xd7)
  ) {
    return "standalone";
  }
  if (marker >= 0xc0 && marker <= 0xdf) {
    return "image-structure";
  }
  return "unknown";
}

export function classifyApplicationSegment(
  reader: ByteReader,
  marker: number,
  payloadOffset: number,
  payloadLength: number,
): JpegApplicationClassification {
  if (marker === 0xe0) {
    if (matchesPayload(reader, payloadOffset, payloadLength, JFIF_SIGNATURE)) {
      return { metadataKind: "jfif", metadataSubtype: "jfif" };
    }
    if (matchesPayload(reader, payloadOffset, payloadLength, JFXX_SIGNATURE)) {
      return { metadataKind: "jfif", metadataSubtype: "jfxx" };
    }
  }

  if (marker === 0xe1) {
    if (matchesPayload(reader, payloadOffset, payloadLength, EXIF_SIGNATURE)) {
      return { metadataKind: "exif" };
    }
    if (matchesPayload(reader, payloadOffset, payloadLength, XMP_SIGNATURE)) {
      return { metadataKind: "xmp", metadataSubtype: "standard-xmp" };
    }
    if (
      matchesPayload(
        reader,
        payloadOffset,
        payloadLength,
        EXTENDED_XMP_SIGNATURE,
      )
    ) {
      return { metadataKind: "xmp", metadataSubtype: "extended-xmp" };
    }
  }

  if (
    marker === 0xe2 &&
    matchesPayload(reader, payloadOffset, payloadLength, ICC_SIGNATURE)
  ) {
    return { metadataKind: "icc" };
  }

  if (
    marker === 0xed &&
    matchesPayload(reader, payloadOffset, payloadLength, PHOTOSHOP_SIGNATURE)
  ) {
    return { metadataKind: "iptc", metadataSubtype: "photoshop" };
  }

  if (
    marker === 0xee &&
    matchesPayload(reader, payloadOffset, payloadLength, ADOBE_SIGNATURE)
  ) {
    return { metadataKind: "adobe" };
  }

  return { metadataKind: "unknown" };
}
