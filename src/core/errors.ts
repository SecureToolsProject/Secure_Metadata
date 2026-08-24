export type SecureMetadataErrorCode = "NOT_IMPLEMENTED";

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
