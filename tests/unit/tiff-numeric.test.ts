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

describe("TIFF full-range numeric decoding", () => {
  it("preserves full unsigned LONG and signed SLONG ranges", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.ORIENTATION,
          type: TIFF_FIELD_TYPE.LONG,
          count: 1,
          value: 0xffff_ffff,
        },
        {
          tag: TIFF_TAG.IMAGE_DESCRIPTION,
          type: TIFF_FIELD_TYPE.SLONG,
          count: 1,
          value: -0x8000_0000,
        },
      ])
      .finish();
    const values = parseTiff(input, LIMITS).entries.map(({ value }) => value);

    expect(values).toEqual([4_294_967_295, -2_147_483_648]);
  });

  it("preserves exact signed rational components", () => {
    const input = new TiffBuilder()
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
          tag: TIFF_TAG.F_NUMBER,
          type: TIFF_FIELD_TYPE.SRATIONAL,
          count: 1,
          valueOffset: 100,
        },
      ])
      .rational(100, [[-3, 2]], true)
      .finish();

    expect(parseTiff(input, LIMITS).entries[0]?.value).toEqual({
      numerator: -3,
      denominator: 2,
    });
  });
});

describe("TIFF pointer validation", () => {
  it("rejects pointer tags with the wrong type", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.EXIF_IFD_POINTER,
          type: TIFF_FIELD_TYPE.SHORT,
          count: 1,
          value: 40,
        },
      ])
      .finish();

    expect(parseTiff(input, LIMITS).diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_INVALID_POINTER" }),
    );
  });

  it("rejects pointer targets outside the TIFF view", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.GPS_IFD_POINTER,
          type: TIFF_FIELD_TYPE.LONG,
          count: 1,
          value: 900,
        },
      ])
      .finish();

    expect(parseTiff(input, LIMITS).diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_INVALID_POINTER" }),
    );
  });
});
