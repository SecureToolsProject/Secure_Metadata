export type SecureMetadataErrorCode =
  | "NOT_IMPLEMENTED"
  | "INVALID_OFFSET"
  | "INVALID_LENGTH"
  | "OUT_OF_BOUNDS"
  | "INVALID_LIMIT"
  | "INPUT_LIMIT_EXCEEDED";

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

export class NotImplementedError extends SecureMetadataError {
  override readonly name: string = "NotImplementedError";

  constructor(operation: string) {
    super(
      `${operation} is not implemented in the secure-metadata 0.0.0 foundation.`,
      "NOT_IMPLEMENTED",
    );
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
