import type { Diagnostic } from "../core/diagnostics.js";

export type WebPChunkKind =
  "image" | "alpha" | "extended" | "animation" | "metadata" | "unknown";

export type WebPMetadataKind = "exif" | "xmp" | "icc";

export interface WebPChunk {
  readonly fourCC: string;
  readonly offset: number;
  readonly payloadOffset: number;
  readonly payloadLength: number;
  readonly totalLength: number;
  readonly kind: WebPChunkKind;
  readonly metadataKind?: WebPMetadataKind;
  readonly vp8xFlags?: number;
}

export interface WebPParseResult {
  readonly chunks: readonly WebPChunk[];
  readonly complete: boolean;
  readonly containerLength: number;
  readonly diagnostics: readonly Diagnostic[];
}
