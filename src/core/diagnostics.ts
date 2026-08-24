export type DiagnosticSeverity = "warning" | "error";

export type DiagnosticCode =
  "NOT_IMPLEMENTED" | "INPUT_LIMIT_EXCEEDED" | "MALFORMED_INPUT";

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly offset?: number;
}
