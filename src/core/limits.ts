export interface ParseLimits {
  readonly maxInputBytes: number;
  readonly maxSegments: number;
  readonly maxChunks: number;
  readonly maxMetadataEntries: number;
  readonly maxIfdDepth: number;
  readonly maxIfdEntries: number;
  readonly maxStringBytes: number;
  readonly maxDecompressedBytes: number;
  readonly maxDiagnostics: number;
}

export const DEFAULT_PARSE_LIMITS: Readonly<ParseLimits> = Object.freeze({
  maxInputBytes: 100 * 1024 * 1024,
  maxSegments: 4_096,
  maxChunks: 4_096,
  maxMetadataEntries: 10_000,
  maxIfdDepth: 16,
  maxIfdEntries: 4_096,
  maxStringBytes: 4 * 1024 * 1024,
  maxDecompressedBytes: 16 * 1024 * 1024,
  maxDiagnostics: 256,
});
