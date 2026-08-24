import { describe, expect, it } from "vitest";

import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";
import { TIFF_TAG } from "../../src/exif/tags.js";
import { inspectMetadata } from "../../src/index.js";
import {
  concat,
  EXIF,
  JFIF,
  jpeg,
  MARKER,
  segment,
} from "../helpers/jpeg-builder.js";
import { TiffBuilder, type TestByteOrder } from "../helpers/tiff-builder.js";

function integratedTiff(order: TestByteOrder = "little"): Uint8Array {
  return new TiffBuilder(order)
    .ifd(8, [
      {
        tag: TIFF_TAG.MAKE,
        type: TIFF_FIELD_TYPE.ASCII,
        count: 6,
        valueOffset: 200,
      },
      {
        tag: TIFF_TAG.MODEL,
        type: TIFF_FIELD_TYPE.ASCII,
        count: 7,
        valueOffset: 210,
      },
      {
        tag: TIFF_TAG.EXIF_IFD_POINTER,
        type: TIFF_FIELD_TYPE.LONG,
        count: 1,
        value: 80,
      },
      {
        tag: TIFF_TAG.GPS_IFD_POINTER,
        type: TIFF_FIELD_TYPE.LONG,
        count: 1,
        value: 120,
      },
    ])
    .ifd(80, [
      {
        tag: TIFF_TAG.DATE_TIME_ORIGINAL,
        type: TIFF_FIELD_TYPE.ASCII,
        count: 20,
        valueOffset: 300,
      },
    ])
    .ifd(120, [
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
    ])
    .ascii(200, "Canon")
    .ascii(210, "EOS R5")
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
    .ascii(300, "2026:08:24 12:34:56")
    .finish();
}

function exifJpeg(tiff = integratedTiff()): Uint8Array {
  return jpeg(
    segment(MARKER.APP0, JFIF),
    segment(MARKER.APP1, concat(EXIF, tiff)),
  );
}

describe("JPEG EXIF/TIFF integration", () => {
  it("decodes common IFD0, ExifIFD, and GPS entries", () => {
    const report = inspectMetadata(exifJpeg());
    const byName = new Map(report.entries.map((entry) => [entry.name, entry]));

    expect(report.inspectionStatus).toBe("metadata-partial");
    expect(byName.get("EXIF container")).toBeDefined();
    expect(byName.get("Make")).toMatchObject({
      value: "Canon",
      category: "device",
      privacy: "potentially-sensitive",
    });
    expect(byName.get("Model")?.value).toBe("EOS R5");
    expect(byName.get("DateTimeOriginal")).toMatchObject({
      value: "2026:08:24 12:34:56",
      category: "timestamp",
      privacy: "potentially-sensitive",
    });
    expect(byName.get("GPSLatitude")).toMatchObject({
      namespace: "gps",
      category: "location",
      privacy: "sensitive",
    });
    expect(report.diagnostics).toEqual([]);
  });

  it("keeps all TIFF offsets relative to the TIFF header", () => {
    const input = exifJpeg();
    const report = inspectMetadata(input);
    const make = report.entries.find(({ name }) => name === "Make");

    // SOI (2) + APP0 (9) + APP1 marker/length (4) + Exif signature (6).
    const tiffBase = 21;
    expect(make?.source).toMatchObject({
      offset: tiffBase + 10,
      tiffPath: "IFD0/Make",
      tiffTag: TIFF_TAG.MAKE,
      tiffType: TIFF_FIELD_TYPE.ASCII,
      tiffCount: 6,
    });
  });

  it("decodes TIFF correctly inside an exact JPEG Uint8Array subview", () => {
    const embedded = exifJpeg();
    const backing = concat(
      Uint8Array.of(0xaa, 0xbb, 0xcc),
      embedded,
      Uint8Array.of(0xff, 0xd8, 0x49, 0x49),
    );
    const view = new Uint8Array(
      backing.buffer,
      backing.byteOffset + 3,
      embedded.byteLength,
    );
    const report = inspectMetadata(view);

    expect(report.entries.find(({ name }) => name === "Make")?.value).toBe(
      "Canon",
    );
    expect(
      report.entries.find(({ name }) => name === "GPSLongitude"),
    ).toBeDefined();
    expect(report.diagnostics).toEqual([]);
  });

  it.each(["little", "big"] as const)(
    "is deterministic and preserves %s-endian EXIF input",
    (order) => {
      const input = exifJpeg(integratedTiff(order));
      const before = Uint8Array.from(input);

      expect(inspectMetadata(input)).toEqual(inspectMetadata(input));
      expect(input).toEqual(before);
    },
  );

  it("preserves cyclic malformed EXIF input", () => {
    const tiff = new TiffBuilder().ifd(8, [], 8).finish();
    const input = exifJpeg(tiff);
    const before = Uint8Array.from(input);
    const report = inspectMetadata(input);

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_CYCLIC_IFD" }),
    );
    expect(input).toEqual(before);
  });

  it("honors custom TIFF depth and entry limits through inspectMetadata", () => {
    const report = inspectMetadata(exifJpeg(), {
      limits: { maxIfdDepth: 1, maxIfdEntries: 3 },
    });

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_IFD_ENTRY_LIMIT_EXCEEDED" }),
    );
  });
});
