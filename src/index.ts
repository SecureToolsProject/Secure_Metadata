export { inspectMetadata } from "./inspect.js";
export { cleanMetadata } from "./policy/clean.js";
export { verifyMetadata } from "./verify/verify.js";

export {
  BinaryBoundsError,
  InputLimitExceededError,
  InvalidParseLimitError,
  NotImplementedError,
  SecureMetadataError,
} from "./core/errors.js";
export { DEFAULT_PARSE_LIMITS } from "./core/limits.js";

export type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
} from "./core/diagnostics.js";
export type {
  BinaryBoundsErrorCode,
  SecureMetadataErrorCode,
} from "./core/errors.js";
export type { ParseLimits } from "./core/limits.js";
export type {
  BinaryInput,
  CleaningPolicy,
  CleanResult,
  ImageFormat,
  InspectionStatus,
  InspectOptions,
  MetadataCategory,
  MetadataContainer,
  MetadataEntry,
  MetadataNamespace,
  MetadataReport,
  MetadataSource,
  MetadataValue,
  PrivacyRelevance,
  RationalValue,
  VerificationPolicy,
  VerificationResult,
} from "./core/types.js";
