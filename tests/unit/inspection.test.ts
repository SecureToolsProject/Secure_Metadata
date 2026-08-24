import { describe, expect, it } from "vitest";

import {
  InputLimitExceededError,
  InvalidParseLimitError,
  inspectMetadata,
} from "../../src/index.js";

describe("format-only inspection", () => {
  it("returns an explicit format-only report for empty input", () => {
    expect(inspectMetadata(new Uint8Array())).toEqual({
      format: "unknown",
      size: 0,
      inspectionStatus: "format-only",
      entries: [],
      diagnostics: [],
    });
  });

  it("accepts input at the configured maximum", () => {
    const input = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

    expect(
      inspectMetadata(input, { limits: { maxInputBytes: 8 } }).format,
    ).toBe("png");
  });

  it("rejects input above the configured maximum", () => {
    const operation = (): unknown =>
      inspectMetadata(new Uint8Array(9), { limits: { maxInputBytes: 8 } });

    expect(operation).toThrowError(InputLimitExceededError);
    expect(operation).toThrowError(
      expect.objectContaining({
        code: "INPUT_LIMIT_EXCEEDED",
        inputLength: 9,
        maximumLength: 8,
      }),
    );
  });

  it.each([
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid maxInputBytes value %s", (maxInputBytes) => {
    const operation = (): unknown =>
      inspectMetadata(new Uint8Array(), { limits: { maxInputBytes } });

    expect(operation).toThrowError(InvalidParseLimitError);
    expect(operation).toThrowError(
      expect.objectContaining({ code: "INVALID_LIMIT" }),
    );
  });

  it("is structurally deterministic", () => {
    const input = Uint8Array.of(0xff, 0xd8, 0x00);

    expect(inspectMetadata(input)).toEqual(inspectMetadata(input));
  });

  it("does not mutate Uint8Array input", () => {
    const input = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    const before = Uint8Array.from(input);

    inspectMetadata(input);
    expect(input).toEqual(before);
  });

  it("accepts ArrayBuffer input without changing the contract", () => {
    const input = Uint8Array.of(0xff, 0xd8, 0xff, 0xd9).buffer;

    expect(inspectMetadata(input)).toMatchObject({
      format: "jpeg",
      size: 4,
      inspectionStatus: "container-inspected",
    });
  });
});
