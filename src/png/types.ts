import type { Diagnostic } from "../core/diagnostics.js";

export type PngChunkKind =
  | "critical"
  | "image"
  | "metadata"
  | "color"
  | "animation"
  | "ancillary"
  | "unknown";

export type PngMetadataKind = "exif" | "xmp" | "text" | "icc" | "timestamp";

export interface PngChunk {
  readonly fourCC: string;
  readonly offset: number;
  readonly dataOffset: number;
  readonly dataLength: number;
  readonly totalLength: number;
  readonly ancillary: boolean;
  readonly kind: PngChunkKind;
  readonly metadataKind?: PngMetadataKind;
  readonly keyword?: string;
  readonly textCompressed?: boolean;
  readonly crcValid: boolean;
}

export interface PngParseResult {
  readonly chunks: readonly PngChunk[];
  readonly complete: boolean;
  readonly sawIend: boolean;
  readonly containerLength: number;
  readonly diagnostics: readonly Diagnostic[];
}
