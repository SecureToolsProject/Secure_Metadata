import { describe, expect, it } from "vitest";

import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";
import { TIFF_TAG } from "../../src/exif/tags.js";
import { parseTiff, type TiffParseLimits } from "../../src/exif/tiff.js";
import { TiffBuilder } from "../helpers/tiff-builder.js";

const LIMITS: TiffParseLimits = {
  maxIfdEntries: 32,
  maxIfdDepth: 8,
  maxMetadataEntries: 64,
  maxStringBytes: 1_024,
  maxDiagnostics: 8,
};

interface TiffCorpusCase {
  readonly name: string;
  readonly input: Uint8Array;
  readonly diagnostic?: string;
  readonly limits?: Partial<TiffParseLimits>;
  readonly expectedEntries?: number;
}

function changed(
  input: Uint8Array,
  offset: number,
  ...values: number[]
): Uint8Array {
  const output = Uint8Array.from(input);
  output.set(values, offset);
  return output;
}

function pointer(tag: number, target: number): Uint8Array {
  return new TiffBuilder()
    .ifd(8, [
      {
        tag,
        type: TIFF_FIELD_TYPE.LONG,
        count: 1,
        value: target,
      },
    ])
    .finish();
}

function exposure(denominator: number): Uint8Array {
  return new TiffBuilder()
    .ifd(8, [
      {
        tag: TIFF_TAG.EXIF_IFD_POINTER,
        type: TIFF_FIELD_TYPE.LONG,
        count: 1,
        value: 40,
      },
    ])
    .ifd(40, [
      {
        tag: TIFF_TAG.EXPOSURE_TIME,
        type: TIFF_FIELD_TYPE.RATIONAL,
        count: 1,
        valueOffset: 100,
      },
    ])
    .rational(100, [[1, denominator]])
    .finish();
}

const TIFF_CORPUS: readonly TiffCorpusCase[] = [
  {
    name: "tiff-truncated-header",
    input: Uint8Array.of(0x49, 0x49, 42),
    diagnostic: "TIFF_TRUNCATED_HEADER",
  },
  {
    name: "tiff-invalid-byte-order",
    input: Uint8Array.of(0x58, 0x58, 42, 0, 8, 0, 0, 0),
    diagnostic: "TIFF_INVALID_BYTE_ORDER",
  },
  {
    name: "tiff-invalid-magic",
    input: changed(new TiffBuilder().ifd(8, []).finish(), 2, 41, 0),
    diagnostic: "TIFF_INVALID_MAGIC",
  },
  {
    name: "tiff-first-ifd-offset-out-of-bounds",
    input: new TiffBuilder("little", 1_024, 900).finish(),
    diagnostic: "TIFF_INVALID_FIRST_IFD_OFFSET",
  },
  {
    name: "tiff-entry-count-over-limit",
    input: new TiffBuilder()
      .ifd(8, [
        { tag: 1, type: TIFF_FIELD_TYPE.BYTE, count: 1, value: 1 },
        { tag: 2, type: TIFF_FIELD_TYPE.BYTE, count: 1, value: 2 },
      ])
      .finish(),
    diagnostic: "TIFF_IFD_ENTRY_LIMIT_EXCEEDED",
    limits: { maxIfdEntries: 1 },
  },
  {
    name: "tiff-truncated-entry-table",
    input: new TiffBuilder().u16(8, 1).finish(10),
    diagnostic: "TIFF_TRUNCATED_IFD",
  },
  {
    name: "tiff-unsupported-field-type",
    input: new TiffBuilder()
      .ifd(8, [{ tag: TIFF_TAG.MAKE, type: 99, count: 1, value: 0 }])
      .finish(),
    diagnostic: "TIFF_UNSUPPORTED_FIELD_TYPE",
    expectedEntries: 1,
  },
  {
    name: "tiff-huge-value-count",
    input: new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.MAKE,
          type: TIFF_FIELD_TYPE.ASCII,
          count: 0xffff_ffff,
          valueOffset: 100,
        },
      ])
      .finish(),
    diagnostic: "TIFF_INVALID_VALUE_RANGE",
  },
  {
    name: "tiff-invalid-external-value-offset",
    input: new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.MAKE,
          type: TIFF_FIELD_TYPE.ASCII,
          count: 6,
          valueOffset: 900,
        },
      ])
      .finish(),
    diagnostic: "TIFF_INVALID_VALUE_OFFSET",
  },
  {
    name: "tiff-exif-ifd-pointer-out-of-range",
    input: pointer(TIFF_TAG.EXIF_IFD_POINTER, 900),
    diagnostic: "TIFF_INVALID_POINTER",
  },
  {
    name: "tiff-gps-ifd-pointer-out-of-range",
    input: pointer(TIFF_TAG.GPS_IFD_POINTER, 900),
    diagnostic: "TIFF_INVALID_POINTER",
  },
  {
    name: "tiff-self-referencing-ifd",
    input: new TiffBuilder().ifd(8, [], 8).finish(),
    diagnostic: "TIFF_CYCLIC_IFD",
  },
  {
    name: "tiff-two-node-ifd-cycle",
    input: new TiffBuilder().ifd(8, [], 40).ifd(40, [], 8).finish(),
    diagnostic: "TIFF_CYCLIC_IFD",
  },
  {
    name: "tiff-ifd-depth-chain-over-limit",
    input: new TiffBuilder()
      .ifd(8, [], 40)
      .ifd(40, [], 80)
      .ifd(80, [])
      .finish(),
    diagnostic: "TIFF_IFD_DEPTH_LIMIT_EXCEEDED",
    limits: { maxIfdDepth: 2 },
  },
  {
    name: "tiff-zero-rational-denominator",
    input: exposure(0),
    diagnostic: "TIFF_INVALID_RATIONAL",
    expectedEntries: 1,
  },
  {
    name: "tiff-duplicate-tags",
    input: new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.MAKE,
          type: TIFF_FIELD_TYPE.ASCII,
          count: 6,
          valueOffset: 100,
        },
        {
          tag: TIFF_TAG.MAKE,
          type: TIFF_FIELD_TYPE.ASCII,
          count: 6,
          valueOffset: 110,
        },
      ])
      .ascii(100, "Canon")
      .ascii(110, "Nikon")
      .finish(),
    expectedEntries: 2,
  },
  {
    name: "tiff-ascii-string-limit",
    input: new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.MAKE,
          type: TIFF_FIELD_TYPE.ASCII,
          count: 6,
          valueOffset: 100,
        },
      ])
      .ascii(100, "Canon")
      .finish(),
    diagnostic: "TIFF_INVALID_VALUE_RANGE",
    limits: { maxStringBytes: 4 },
  },
];

describe("bounded TIFF malformed corpus", () => {
  it("covers the shared TIFF corruption and traversal families", () => {
    expect(TIFF_CORPUS).toHaveLength(17);
    expect(new Set(TIFF_CORPUS.map(({ name }) => name)).size).toBe(17);
  });

  it("terminates deterministically without native exceptions or mutation", () => {
    for (const testCase of TIFF_CORPUS) {
      const before = Uint8Array.from(testCase.input);
      const limits = { ...LIMITS, ...testCase.limits };
      const first = parseTiff(testCase.input, limits);
      const second = parseTiff(testCase.input, limits);

      expect(first, testCase.name).toEqual(second);
      expect(testCase.input, testCase.name).toEqual(before);
      if (testCase.diagnostic !== undefined) {
        expect(first.diagnostics, testCase.name).toContainEqual(
          expect.objectContaining({ code: testCase.diagnostic }),
        );
      }
      if (testCase.expectedEntries !== undefined) {
        expect(first.entries, testCase.name).toHaveLength(
          testCase.expectedEntries,
        );
      }
    }
  });
});
