import type { Diagnostic } from "../core/diagnostics.js";

export type JpegSegmentKind =
  | "standalone"
  | "application"
  | "comment"
  | "image-structure"
  | "scan"
  | "unknown";

export type JpegMetadataKind =
  "exif" | "xmp" | "icc" | "iptc" | "jfif" | "adobe" | "unknown";

export type JpegMetadataSubtype =
  "standard-xmp" | "extended-xmp" | "jfif" | "jfxx" | "photoshop";

export interface JpegSegment {
  readonly marker: number;
  readonly markerName: string;
  readonly offset: number;
  readonly length: number;
  /** Internal copy/remove range, including any marker fill bytes. */
  readonly rangeOffset: number;
  readonly rangeLength: number;
  readonly payloadOffset?: number;
  readonly payloadLength?: number;
  readonly kind: JpegSegmentKind;
  readonly metadataKind?: JpegMetadataKind;
  readonly metadataSubtype?: JpegMetadataSubtype;
}

export interface JpegParseResult {
  readonly segments: readonly JpegSegment[];
  readonly complete: boolean;
  readonly sawSoi: boolean;
  readonly sawEoi: boolean;
  readonly diagnostics: readonly Diagnostic[];
}
