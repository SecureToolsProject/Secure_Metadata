import type { Diagnostic } from "./diagnostics.js";

export type SecureMetadataErrorCode =
  | "INVALID_OFFSET"
  | "INVALID_LENGTH"
  | "OUT_OF_BOUNDS"
  | "INVALID_LIMIT"
  | "INPUT_LIMIT_EXCEEDED"
  | "UNSUPPORTED_FORMAT"
  | "INCOMPLETE_JPEG"
  | "INCOMPLETE_WEBP"
  | "INCOMPLETE_PNG"
  | "CLEAN_OUTPUT_SIZE_INVALID";

export class SecureMetadataError extends Error {
  override readonly name: string = "SecureMetadataError";

  constructor(
    message: string,
    readonly code: SecureMetadataErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export type BinaryBoundsErrorCode =
  "INVALID_OFFSET" | "INVALID_LENGTH" | "OUT_OF_BOUNDS";

export class BinaryBoundsError extends SecureMetadataError {
  override readonly name: string = "BinaryBoundsError";

  constructor(
    code: BinaryBoundsErrorCode,
    readonly inputLength: number,
    readonly offset: number,
    readonly requestedLength: number,
  ) {
    super(
      `Invalid binary range: offset ${String(offset)}, length ${String(requestedLength)}, input length ${String(inputLength)}.`,
      code,
    );
  }
}

export class InvalidParseLimitError extends SecureMetadataError {
  override readonly name: string = "InvalidParseLimitError";

  constructor(
    readonly limitName: string,
    readonly value: number,
  ) {
    super(
      `Parse limit ${limitName} must be a non-negative safe integer; received ${String(value)}.`,
      "INVALID_LIMIT",
    );
  }
}

export class InputLimitExceededError extends SecureMetadataError {
  override readonly name: string = "InputLimitExceededError";

  constructor(
    readonly inputLength: number,
    readonly maximumLength: number,
  ) {
    super(
      `Input length ${String(inputLength)} exceeds maxInputBytes ${String(maximumLength)}.`,
      "INPUT_LIMIT_EXCEEDED",
    );
  }
}

export class UnsupportedFormatError extends SecureMetadataError {
  override readonly name: string = "UnsupportedFormatError";

  constructor(
    readonly operation: "cleanMetadata" | "verifyMetadata",
    readonly format: "unknown",
  ) {
    super(
      `${operation} does not support ${format} input.`,
      "UNSUPPORTED_FORMAT",
    );
  }
}

export class IncompleteJpegError extends SecureMetadataError {
  override readonly name: string = "IncompleteJpegError";

  constructor(
    readonly operation: "cleanMetadata" | "verifyMetadata",
    readonly diagnostics: readonly Diagnostic[],
  ) {
    super(
      `${operation} requires a structurally complete JPEG ending at EOI.`,
      "INCOMPLETE_JPEG",
    );
  }
}

export class IncompleteWebPError extends SecureMetadataError {
  override readonly name: string = "IncompleteWebPError";

  constructor(
    readonly operation: "cleanMetadata" | "verifyMetadata",
    readonly diagnostics: readonly Diagnostic[],
  ) {
    super(
      `${operation} requires a structurally complete WebP RIFF container.`,
      "INCOMPLETE_WEBP",
    );
  }
}

export class IncompletePngError extends SecureMetadataError {
  override readonly name: string = "IncompletePngError";

  constructor(
    readonly operation: "cleanMetadata" | "verifyMetadata",
    readonly diagnostics: readonly Diagnostic[],
  ) {
    super(
      `${operation} requires a structurally complete PNG ending at IEND.`,
      "INCOMPLETE_PNG",
    );
  }
}
