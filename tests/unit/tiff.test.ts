import { describe, expect, it } from "vitest";

import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";
import { parseTiff } from "../../src/exif/tiff.js";
import { TIFF_TAG } from "../../src/exif/tags.js";
import { TiffBuilder } from "../helpers/tiff-builder.js";

const LIMITS = {
  maxIfdEntries: 4_096,
  maxIfdDepth: 16,
  maxMetadataEntries: 10_000,
  maxStringBytes: 4 * 1024 * 1024,
};

describe("TIFF header and empty IFD", () => {
  it.each(["little", "big"] as const)(
    "parses an empty %s-endian IFD",
    (order) => {
      const result = parseTiff(
        new TiffBuilder(order).ifd(8, []).finish(),
        LIMITS,
      );

      expect(result).toEqual({
        byteOrder: order,
        complete: true,
        entries: [],
        diagnostics: [],
      });
    },
  );

  it("accepts a zero first-IFD offset as no IFD", () => {
    const result = parseTiff(new TiffBuilder("little", 32, 0).finish(), LIMITS);

    expect(result).toMatchObject({
      complete: true,
      entries: [],
      diagnostics: [],
    });
  });

  it.each([
    [new Uint8Array(), "TIFF_TRUNCATED_HEADER"],
    [Uint8Array.of(0x49, 0x49, 0x2a), "TIFF_TRUNCATED_HEADER"],
  ] as const)("rejects a truncated TIFF header", (input, code) => {
    expect(parseTiff(input, LIMITS).diagnostics).toContainEqual(
      expect.objectContaining({ code }),
    );
  });

  it("rejects unsupported byte order", () => {
    const input = new TiffBuilder().ifd(8, []).finish();
    input[0] = 0x58;

    expect(parseTiff(input, LIMITS).diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_INVALID_BYTE_ORDER" }),
    );
  });

  it("rejects invalid magic", () => {
    const input = new TiffBuilder().ifd(8, []).finish();
    input[2] = 0;
    input[3] = 0;

    expect(parseTiff(input, LIMITS).diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_INVALID_MAGIC" }),
    );
  });

  it("rejects a first IFD offset outside the TIFF view", () => {
    const input = new TiffBuilder("little", 32, 100).finish();

    expect(parseTiff(input, LIMITS).diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_INVALID_FIRST_IFD_OFFSET" }),
    );
  });
});

describe("TIFF inline and offset values", () => {
  it.each(["little", "big"] as const)(
    "decodes an inline SHORT in %s endian order",
    (order) => {
      const input = new TiffBuilder(order)
        .ifd(8, [
          {
            tag: TIFF_TAG.ORIENTATION,
            type: TIFF_FIELD_TYPE.SHORT,
            count: 1,
            value: 6,
          },
        ])
        .finish();
      const result = parseTiff(input, LIMITS);

      expect(result.entries[0]).toMatchObject({
        name: "Orientation",
        value: 6,
        path: "IFD0/Orientation",
      });
    },
  );

  it.each(["little", "big"] as const)(
    "decodes two inline SHORT values in %s endian order",
    (order) => {
      const input = new TiffBuilder(order)
        .ifd(8, [
          {
            tag: TIFF_TAG.ORIENTATION,
            type: TIFF_FIELD_TYPE.SHORT,
            count: 2,
            value: [1, 8],
          },
        ])
        .finish();

      expect(parseTiff(input, LIMITS).entries[0]?.value).toEqual([1, 8]);
    },
  );

  it("decodes an inline BYTE", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.IMAGE_DESCRIPTION,
          type: TIFF_FIELD_TYPE.BYTE,
          count: 1,
          value: 7,
        },
      ])
      .finish();

    expect(parseTiff(input, LIMITS).entries[0]?.value).toBe(7);
  });

  it.each(["little", "big"] as const)(
    "decodes bounded offset ASCII and trims at NUL in %s endian order",
    (order) => {
      const input = new TiffBuilder(order)
        .ifd(8, [
          {
            tag: TIFF_TAG.MAKE,
            type: TIFF_FIELD_TYPE.ASCII,
            count: 8,
            valueOffset: 100,
          },
        ])
        .ascii(100, "Canon", true)
        .bytes(106, [0x58, 0x59])
        .finish();
      const entry = parseTiff(input, LIMITS).entries[0];

      expect(entry).toMatchObject({
        name: "Make",
        value: "Canon",
        path: "IFD0/Make",
        valueOffset: 100,
      });
    },
  );
});

describe("ExifIFD and rational decoding", () => {
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

  it("traverses ExifIFD and preserves exact rational values", () => {
    const result = parseTiff(exposure(125), LIMITS);

    expect(result.entries).toEqual([
      expect.objectContaining({
        name: "ExposureTime",
        path: "IFD0/ExifIFD/ExposureTime",
        value: { numerator: 1, denominator: 125 },
      }),
    ]);
  });

  it("preserves zero-denominator rationals with a diagnostic", () => {
    const result = parseTiff(exposure(0), LIMITS);

    expect(result.entries[0]?.value).toEqual({ numerator: 1, denominator: 0 });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_INVALID_RATIONAL" }),
    );
  });
});
