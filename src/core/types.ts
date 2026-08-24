import type { Diagnostic } from "./diagnostics.js";
import type { ParseLimits } from "./limits.js";

export type BinaryInput = Uint8Array | ArrayBuffer;

export type ImageFormat = "jpeg" | "png" | "webp" | "unknown";

export type MetadataNamespace =
  | "exif"
  | "tiff"
  | "gps"
  | "xmp"
  | "iptc"
  | "jpeg-comment"
  | "png-text"
  | "icc"
  | "container"
  | "unknown";

export type MetadataCategory =
  | "location"
  | "device"
  | "timestamp"
  | "identity"
  | "software"
  | "description"
  | "technical"
  | "color"
  | "rendering"
  | "rights"
  | "unknown";

export type PrivacyRelevance =
  "sensitive" | "potentially-sensitive" | "non-sensitive" | "unknown";

export type MetadataValue = string | number | boolean | Uint8Array;

export type MetadataContainer =
  "jpeg-segment" | "png-chunk" | "webp-chunk" | "tiff-ifd" | "unknown";

export interface MetadataSource {
  readonly format: ImageFormat;
  readonly container?: MetadataContainer;
  readonly offset?: number;
  readonly length?: number;
  readonly jpegMarker?: number;
  readonly chunkType?: string;
  readonly tiffPath?: readonly number[];
}

export interface MetadataEntry {
  readonly id: string;
  readonly namespace: MetadataNamespace;
  readonly name: string;
  readonly category: MetadataCategory;
  readonly privacy: PrivacyRelevance;
  readonly value?: MetadataValue;
  readonly source: MetadataSource;
}

export interface InspectOptions {
  readonly limits?: Partial<ParseLimits>;
}

export interface MetadataReport {
  readonly format: ImageFormat;
  readonly entries: readonly MetadataEntry[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface CleaningPolicy {
  readonly preserveColorProfiles?: boolean;
  readonly limits?: Partial<ParseLimits>;
}

export interface CleanResult {
  readonly output: Uint8Array;
  readonly report: MetadataReport;
  readonly removedEntryIds: readonly string[];
}

export interface VerificationPolicy {
  readonly requireNoPrivacyRelevantMetadata?: boolean;
  readonly limits?: Partial<ParseLimits>;
}

export interface VerificationResult {
  readonly valid: boolean;
  readonly report: MetadataReport;
  readonly diagnostics: readonly Diagnostic[];
}
