export type DiagnosticSeverity = "warning" | "error";

export type DiagnosticCode =
  | "NOT_IMPLEMENTED"
  | "INPUT_LIMIT_EXCEEDED"
  | "MALFORMED_INPUT"
  | "JPEG_INVALID_SOI"
  | "JPEG_INVALID_MARKER"
  | "JPEG_TRUNCATED_MARKER"
  | "JPEG_TRUNCATED_SEGMENT_LENGTH"
  | "JPEG_INVALID_SEGMENT_LENGTH"
  | "JPEG_TRUNCATED_SEGMENT"
  | "JPEG_TRUNCATED_SCAN"
  | "JPEG_MISSING_EOI"
  | "JPEG_SEGMENT_LIMIT_EXCEEDED"
  | "JPEG_TRAILING_DATA";

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly offset?: number;
}
