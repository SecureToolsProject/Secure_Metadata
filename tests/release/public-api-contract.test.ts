import { describe, expect, it } from "vitest";

import * as api from "../../src/index.js";

const EXPECTED_RUNTIME_EXPORTS = [
  "BinaryBoundsError",
  "DEFAULT_CLEANING_POLICY",
  "DEFAULT_JPEG_CLEANING_POLICY",
  "DEFAULT_JPEG_VERIFICATION_POLICY",
  "DEFAULT_PARSE_LIMITS",
  "DEFAULT_PNG_CLEANING_POLICY",
  "DEFAULT_PNG_VERIFICATION_POLICY",
  "DEFAULT_WEBP_CLEANING_POLICY",
  "DEFAULT_WEBP_VERIFICATION_POLICY",
  "IncompleteJpegError",
  "IncompletePngError",
  "IncompleteWebPError",
  "InputLimitExceededError",
  "InvalidParseLimitError",
  "SecureMetadataError",
  "UnsupportedFormatError",
  "cleanMetadata",
  "inspectMetadata",
  "verifyMetadata",
] as const;

describe("v0.1 public API contract", () => {
  it("exports exactly the frozen runtime surface", () => {
    expect(Object.keys(api).sort()).toEqual(
      [...EXPECTED_RUNTIME_EXPORTS].sort(),
    );
  });

  it("keeps the three public operations callable", () => {
    expect(api.inspectMetadata).toBeTypeOf("function");
    expect(api.cleanMetadata).toBeTypeOf("function");
    expect(api.verifyMetadata).toBeTypeOf("function");
  });
});
