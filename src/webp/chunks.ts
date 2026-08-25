import type { WebPChunkKind, WebPMetadataKind } from "./types.js";

export const WEBP_VP8X_FLAG = Object.freeze({
  icc: 0x20,
  alpha: 0x10,
  exif: 0x08,
  xmp: 0x04,
  animation: 0x02,
});

export const WEBP_VP8X_METADATA_MASK =
  WEBP_VP8X_FLAG.icc | WEBP_VP8X_FLAG.exif | WEBP_VP8X_FLAG.xmp;

export function classifyWebPChunk(fourCC: string): {
  readonly kind: WebPChunkKind;
  readonly metadataKind?: WebPMetadataKind;
} {
  switch (fourCC) {
    case "VP8 ":
    case "VP8L":
      return { kind: "image" };
    case "ALPH":
      return { kind: "alpha" };
    case "VP8X":
      return { kind: "extended" };
    case "ANIM":
    case "ANMF":
      return { kind: "animation" };
    case "EXIF":
      return { kind: "metadata", metadataKind: "exif" };
    case "XMP ":
      return { kind: "metadata", metadataKind: "xmp" };
    case "ICCP":
      return { kind: "metadata", metadataKind: "icc" };
    default:
      return { kind: "unknown" };
  }
}
