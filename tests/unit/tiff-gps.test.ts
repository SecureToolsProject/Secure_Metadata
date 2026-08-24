import { describe, expect, it } from "vitest";

import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";
import { parseTiff } from "../../src/exif/tiff.js";
import { TIFF_TAG } from "../../src/exif/tags.js";
import { TiffBuilder, type TestByteOrder } from "../helpers/tiff-builder.js";

const LIMITS = {
  maxIfdEntries: 4_096,
  maxIfdDepth: 16,
  maxMetadataEntries: 10_000,
  maxStringBytes: 4 * 1024 * 1024,
};

function gpsTiff(order: TestByteOrder): Uint8Array {
  return new TiffBuilder(order)
    .ifd(8, [
      {
        tag: TIFF_TAG.GPS_IFD_POINTER,
        type: TIFF_FIELD_TYPE.LONG,
        count: 1,
        value: 64,
      },
    ])
    .ifd(64, [
      {
        tag: 0x0000,
        type: TIFF_FIELD_TYPE.BYTE,
        count: 4,
        value: [2, 3, 0, 0],
      },
      { tag: 0x0001, type: TIFF_FIELD_TYPE.ASCII, count: 2, value: [0x4e, 0] },
      {
        tag: 0x0002,
        type: TIFF_FIELD_TYPE.RATIONAL,
        count: 3,
        valueOffset: 240,
      },
      { tag: 0x0003, type: TIFF_FIELD_TYPE.ASCII, count: 2, value: [0x45, 0] },
      {
        tag: 0x0004,
        type: TIFF_FIELD_TYPE.RATIONAL,
        count: 3,
        valueOffset: 264,
      },
      { tag: 0x0005, type: TIFF_FIELD_TYPE.BYTE, count: 1, value: 0 },
      {
        tag: 0x0006,
        type: TIFF_FIELD_TYPE.RATIONAL,
        count: 1,
        valueOffset: 288,
      },
      {
        tag: 0x0007,
        type: TIFF_FIELD_TYPE.RATIONAL,
        count: 3,
        valueOffset: 296,
      },
      { tag: 0x001d, type: TIFF_FIELD_TYPE.ASCII, count: 11, valueOffset: 320 },
    ])
    .rational(240, [
      [37, 1],
      [48, 1],
      [30, 1],
    ])
    .rational(264, [
      [122, 1],
      [24, 1],
      [15, 1],
    ])
    .rational(288, [[15, 2]])
    .rational(296, [
      [12, 1],
      [34, 1],
      [56, 1],
    ])
    .ascii(320, "2026:08:24")
    .finish();
}

describe("GPS IFD decoding", () => {
  it.each(["little", "big"] as const)(
    "decodes common GPS tags in %s endian order",
    (order) => {
      const result = parseTiff(gpsTiff(order), LIMITS);
      const byName = new Map(
        result.entries.map((entry) => [entry.name, entry]),
      );

      expect(byName.get("GPSVersionID")?.value).toBe("2.3.0.0");
      expect(byName.get("GPSLatitudeRef")?.value).toBe("N");
      expect(byName.get("GPSLatitude")?.value).toEqual([
        { numerator: 37, denominator: 1 },
        { numerator: 48, denominator: 1 },
        { numerator: 30, denominator: 1 },
      ]);
      expect(byName.get("GPSLongitudeRef")?.value).toBe("E");
      expect(byName.get("GPSLongitude")?.value).toEqual([
        { numerator: 122, denominator: 1 },
        { numerator: 24, denominator: 1 },
        { numerator: 15, denominator: 1 },
      ]);
      expect(byName.get("GPSAltitude")?.value).toEqual({
        numerator: 15,
        denominator: 2,
      });
      expect(byName.get("GPSTimeStamp")?.value).toHaveLength(3);
      expect(byName.get("GPSDateStamp")?.value).toBe("2026:08:24");
      expect(byName.get("GPSLatitude")?.path).toBe("IFD0/GPSIFD/GPSLatitude");
      expect(byName.get("GPSLatitude")).toMatchObject({
        namespace: "gps",
        category: "location",
        privacy: "sensitive",
      });
      expect(result.diagnostics).toEqual([]);
    },
  );

  it("does not derive floating-point coordinates", () => {
    const latitude = parseTiff(gpsTiff("little"), LIMITS).entries.find(
      ({ name }) => name === "GPSLatitude",
    );

    expect(latitude?.value).toEqual([
      { numerator: 37, denominator: 1 },
      { numerator: 48, denominator: 1 },
      { numerator: 30, denominator: 1 },
    ]);
  });
});
