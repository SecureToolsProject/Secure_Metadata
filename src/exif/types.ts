import type {
  MetadataCategory,
  MetadataNamespace,
  MetadataValue,
  PrivacyRelevance,
} from "../core/types.js";
import type { Diagnostic } from "../core/diagnostics.js";
import type { TiffByteOrder } from "./tiff-reader.js";

export type TiffIfdKind = "ifd0" | "exif" | "gps" | "next";

export interface TiffDecodedEntry {
  readonly tag: number;
  readonly type: number;
  readonly count: number;
  readonly name: string;
  readonly namespace: MetadataNamespace;
  readonly category: MetadataCategory;
  readonly privacy: PrivacyRelevance;
  readonly value?: MetadataValue;
  readonly path: string;
  readonly entryOffset: number;
  readonly valueOffset: number;
  readonly valueLength: number;
}

export interface TiffParseResult {
  readonly byteOrder?: TiffByteOrder;
  readonly complete: boolean;
  readonly entries: readonly TiffDecodedEntry[];
  readonly diagnostics: readonly Diagnostic[];
  readonly entryLimitExceeded?: true;
}
