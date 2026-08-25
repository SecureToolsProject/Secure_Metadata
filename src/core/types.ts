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
  | "png-time"
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

export interface RationalValue {
  readonly numerator: number;
  readonly denominator: number;
}

export type MetadataValue =
  | string
  | number
  | boolean
  | Uint8Array
  | RationalValue
  | readonly RationalValue[]
  | readonly number[];

export type MetadataContainer =
  "jpeg-segment" | "png-chunk" | "webp-chunk" | "tiff-ifd" | "unknown";

export interface MetadataSource {
  readonly format: ImageFormat;
  readonly container?: MetadataContainer;
  readonly offset?: number;
  readonly length?: number;
  readonly jpegMarker?: number;
  readonly chunkType?: string;
  readonly tiffPath?: string;
  readonly tiffTag?: number;
  readonly tiffType?: number;
  readonly tiffCount?: number;
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

export type InspectionStatus =
  | "format-only"
  | "container-inspected"
  | "container-partial"
  | "metadata-partial"
  | "metadata-inspected";

export interface MetadataReport {
  readonly format: ImageFormat;
  readonly size: number;
  readonly inspectionStatus: InspectionStatus;
  readonly entries: readonly MetadataEntry[];
  readonly diagnostics: readonly Diagnostic[];
  readonly metadataTruncated?: true;
}

export interface CleaningPolicy {
  readonly removeExif?: boolean;
  readonly removeXmp?: boolean;
  readonly removeIptc?: boolean;
  readonly removeComments?: boolean;
  readonly removeTextMetadata?: boolean;
  readonly removeTimestamps?: boolean;
  readonly preserveIcc?: boolean;
  /** @deprecated Use preserveIcc. */
  readonly preserveColorProfiles?: boolean;
  readonly limits?: Partial<ParseLimits>;
}

export interface MetadataChange {
  readonly namespace: MetadataNamespace;
  readonly action: "removed" | "preserved";
  readonly name: string;
  readonly source: MetadataSource;
}

export interface CleanResult {
  readonly output: Uint8Array;
  readonly format: "jpeg" | "webp" | "png";
  readonly report: MetadataReport;
  readonly removed: readonly MetadataChange[];
  readonly preserved: readonly MetadataChange[];
  readonly diagnostics: readonly Diagnostic[];
}

export type VerificationExpectation = "absent" | "present" | "ignore";

export interface VerificationPolicy {
  readonly exif?: VerificationExpectation;
  readonly xmp?: VerificationExpectation;
  readonly iptc?: VerificationExpectation;
  readonly comments?: VerificationExpectation;
  readonly textMetadata?: VerificationExpectation;
  readonly timestamps?: VerificationExpectation;
  readonly icc?: VerificationExpectation;
  readonly requireNoPrivacyRelevantMetadata?: boolean;
  readonly limits?: Partial<ParseLimits>;
}

export interface VerificationCheck {
  readonly namespace:
    "exif" | "xmp" | "iptc" | "jpeg-comment" | "png-text" | "png-time" | "icc";
  readonly expected: Exclude<VerificationExpectation, "ignore">;
  readonly actual: "absent" | "present";
  readonly passed: boolean;
}

export interface VerificationResult {
  readonly valid: boolean;
  readonly checks: readonly VerificationCheck[];
  readonly report: MetadataReport;
  readonly diagnostics: readonly Diagnostic[];
}
