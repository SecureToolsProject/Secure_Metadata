export { inspectMetadata } from "./inspect.js";
export { cleanMetadata, DEFAULT_JPEG_CLEANING_POLICY } from "./policy/clean.js";
export { DEFAULT_CLEANING_POLICY } from "./policy/normalize.js";
export { DEFAULT_PNG_CLEANING_POLICY } from "./png/clean.js";
export { DEFAULT_WEBP_CLEANING_POLICY } from "./webp/clean.js";
export {
  DEFAULT_JPEG_VERIFICATION_POLICY,
  DEFAULT_PNG_VERIFICATION_POLICY,
  DEFAULT_WEBP_VERIFICATION_POLICY,
  verifyMetadata,
} from "./verify/verify.js";

export {
  BinaryBoundsError,
  IncompleteJpegError,
  IncompletePngError,
  IncompleteWebPError,
  InputLimitExceededError,
  InvalidParseLimitError,
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
