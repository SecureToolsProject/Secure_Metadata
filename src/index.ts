export { inspectMetadata } from "./inspect.js";
export { cleanMetadata, DEFAULT_JPEG_CLEANING_POLICY } from "./policy/clean.js";
export {
  DEFAULT_JPEG_VERIFICATION_POLICY,
  verifyMetadata,
} from "./verify/verify.js";

export {
  BinaryBoundsError,
  IncompleteJpegError,
  InputLimitExceededError,
  InvalidParseLimitError,
  NotImplementedError,
  SecureMetadataError,
  UnsupportedFormatError,
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
  MetadataChange,
  MetadataContainer,
  MetadataEntry,
  MetadataNamespace,
  MetadataReport,
  MetadataSource,
  MetadataValue,
  PrivacyRelevance,
  RationalValue,
  VerificationCheck,
  VerificationExpectation,
  VerificationPolicy,
  VerificationResult,
} from "./core/types.js";
