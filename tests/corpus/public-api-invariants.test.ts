import { describe, expect, it } from "vitest";

import {
  cleanMetadata,
  inspectMetadata,
  SecureMetadataError,
  verifyMetadata,
} from "../../src/index.js";
import { chunk, png } from "../helpers/png-builder.js";
import { CORPUS_COUNTS, MALFORMED_CORPUS } from "./cases.js";

function captureError(operation: () => unknown): unknown {
  try {
    return operation();
  } catch (error) {
    return error;
  }
}

describe("deterministic malformed corpus", () => {
  it("covers named generic and container corruption families", () => {
    expect(CORPUS_COUNTS).toEqual({ generic: 9, jpeg: 14, webp: 13, png: 14 });
    expect(new Set(MALFORMED_CORPUS.map(({ name }) => name)).size).toBe(
      MALFORMED_CORPUS.length,
    );
  });

  it("inspects deterministically without native exceptions or input mutation", () => {
    for (const testCase of MALFORMED_CORPUS) {
      const before = Uint8Array.from(testCase.input);
      const configuredLimits =
        testCase.limits === undefined ? undefined : { limits: testCase.limits };
      const first = captureError(() =>
        inspectMetadata(testCase.input, configuredLimits),
      );
      const second = captureError(() =>
        inspectMetadata(testCase.input, configuredLimits),
      );

      expect(first, testCase.name).not.toBeInstanceOf(RangeError);
      expect(first, testCase.name).not.toBeInstanceOf(TypeError);
      expect(first, testCase.name).toEqual(second);
      expect(first, testCase.name).toMatchObject({
        format: testCase.expectedFormat,
        ...(testCase.expectedStatus === undefined
          ? {}
          : { inspectionStatus: testCase.expectedStatus }),
      });
      if (testCase.expectedDiagnostic !== undefined) {
        expect(first, testCase.name).toMatchObject({
          diagnostics: expect.arrayContaining([
            expect.objectContaining({ code: testCase.expectedDiagnostic }),
          ]),
        });
      }
      expect(testCase.input, testCase.name).toEqual(before);
    }
  });

  it("fails closed before output or reconstructs a complete deterministic result", () => {
    for (const testCase of MALFORMED_CORPUS) {
      const before = Uint8Array.from(testCase.input);
      const configuredLimits =
        testCase.limits === undefined ? undefined : { limits: testCase.limits };
      if (testCase.cleanable === true) {
        const first = cleanMetadata(testCase.input, configuredLimits);
        const second = cleanMetadata(testCase.input, configuredLimits);

        expect(first.output, testCase.name).toEqual(second.output);
        expect(first.output.byteLength, testCase.name).toBeLessThanOrEqual(
          testCase.input.byteLength,
        );
        expect(first.report.inspectionStatus, testCase.name).not.toBe(
          "container-partial",
        );
        expect(verifyMetadata(first.output).valid, testCase.name).toBe(true);
      } else {
        const error = captureError(() =>
          cleanMetadata(testCase.input, configuredLimits),
        );
        expect(error, testCase.name).toBeInstanceOf(SecureMetadataError);
        expect(error, testCase.name).toMatchObject({
          code: testCase.cleanError,
        });

        const verifyError = captureError(() =>
          verifyMetadata(testCase.input, configuredLimits),
        );
        expect(verifyError, testCase.name).toBeInstanceOf(SecureMetadataError);
        expect(verifyError, testCase.name).toMatchObject({
          code: testCase.cleanError,
        });
      }
      expect(testCase.input, testCase.name).toEqual(before);
    }
  });

  it("preserves invalid CRCs in retained PNG chunks instead of repairing them", () => {
    const testCase = MALFORMED_CORPUS.find(
      ({ name }) => name === "png-invalid-retained-crc",
    );
    expect(testCase).toBeDefined();
    if (testCase === undefined) {
      throw new Error("PNG invalid-CRC corpus case is missing.");
    }

    const result = cleanMetadata(testCase.input);
    expect(result.output).toEqual(testCase.input);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "PNG_INVALID_CRC" }),
    );
  });
});

describe("cheap malformed-input limit stress", () => {
  it.each([0, 1, 2] as const)(
    "caps diagnostics at maxDiagnostics %i without changing completeness",
    (maxDiagnostics) => {
      const input = png([
        chunk("IDAT", Uint8Array.of(1), 0),
        chunk("IDAT", Uint8Array.of(2), 0),
        chunk("IDAT", Uint8Array.of(3), 0),
        chunk("IEND"),
      ]);
      const report = inspectMetadata(input, { limits: { maxDiagnostics } });

      expect(report.inspectionStatus).toBe("container-inspected");
      expect(report.diagnostics).toHaveLength(maxDiagnostics);
    },
  );
});
