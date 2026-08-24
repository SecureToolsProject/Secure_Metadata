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

describe("TIFF traversal limits and cycles", () => {
  it("detects an IFD0 next-pointer cycle", () => {
    const result = parseTiff(new TiffBuilder().ifd(8, [], 8).finish(), LIMITS);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_CYCLIC_IFD" }),
    );
  });

  it("detects an ExifIFD pointer cycle back to IFD0", () => {
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
          tag: TIFF_TAG.EXIF_IFD_POINTER,
          type: TIFF_FIELD_TYPE.LONG,
          count: 1,
          value: 8,
        },
      ])
      .finish();

    expect(parseTiff(input, LIMITS).diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_CYCLIC_IFD" }),
    );
  });

  it("enforces root-as-depth-one traversal semantics", () => {
    const input = new TiffBuilder()
      .ifd(8, [], 40)
      .ifd(40, [], 80)
      .ifd(80, [])
      .finish();
    const result = parseTiff(input, { ...LIMITS, maxIfdDepth: 1 });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_IFD_DEPTH_LIMIT_EXCEEDED" }),
    );
  });

  it("enforces maxIfdEntries before entry iteration", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        { tag: 1, type: TIFF_FIELD_TYPE.BYTE, count: 1, value: 1 },
        { tag: 2, type: TIFF_FIELD_TYPE.BYTE, count: 1, value: 2 },
      ])
      .finish();
    const result = parseTiff(input, { ...LIMITS, maxIfdEntries: 1 });

    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_IFD_ENTRY_LIMIT_EXCEEDED" }),
    );
  });

  it("follows a bounded next IFD and gives it a deterministic path", () => {
    const input = new TiffBuilder()
      .ifd(8, [], 40)
      .ifd(40, [
        {
          tag: TIFF_TAG.MAKE,
          type: TIFF_FIELD_TYPE.ASCII,
          count: 6,
          valueOffset: 100,
        },
      ])
      .ascii(100, "Canon")
      .finish();

    expect(parseTiff(input, LIMITS).entries[0]).toMatchObject({
      name: "Make",
      path: "IFD1/Make",
      value: "Canon",
    });
  });
});

describe("malformed TIFF IFDs and values", () => {
  it.each([
    new TiffBuilder().u16(8, 1).finish(10),
    new TiffBuilder().u16(8, 2).bytes(10, new Uint8Array(12)).finish(22),
  ])("rejects truncated IFD tables without native exceptions", (input) => {
    expect(() => parseTiff(input, LIMITS)).not.toThrow();
    expect(parseTiff(input, LIMITS).diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_TRUNCATED_IFD" }),
    );
  });

  it("recovers from an invalid value offset and decodes a later entry", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.MAKE,
          type: TIFF_FIELD_TYPE.ASCII,
          count: 6,
          valueOffset: 900,
        },
        {
          tag: TIFF_TAG.ORIENTATION,
          type: TIFF_FIELD_TYPE.SHORT,
          count: 1,
          value: 6,
        },
      ])
      .finish();
    const result = parseTiff(input, LIMITS);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_INVALID_VALUE_OFFSET" }),
    );
    expect(
      result.entries.find(({ name }) => name === "Orientation")?.value,
    ).toBe(6);
  });

  it("recovers from an unsupported field type", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        { tag: TIFF_TAG.MAKE, type: 99, count: 1, value: 0 },
        {
          tag: TIFF_TAG.ORIENTATION,
          type: TIFF_FIELD_TYPE.SHORT,
          count: 1,
          value: 3,
        },
      ])
      .finish();
    const result = parseTiff(input, LIMITS);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_UNSUPPORTED_FIELD_TYPE" }),
    );
    expect(
      result.entries.find(({ name }) => name === "Orientation")?.value,
    ).toBe(3);
  });

  it("rejects extreme counts before allocation or value access", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.MAKE,
          type: TIFF_FIELD_TYPE.ASCII,
          count: 0xffff_ffff,
          valueOffset: 100,
        },
      ])
      .finish();
    const result = parseTiff(input, LIMITS);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_INVALID_VALUE_RANGE" }),
    );
  });

  it("preserves duplicate tags in file order", () => {
    const input = new TiffBuilder()
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
      .finish();

    expect(parseTiff(input, LIMITS).entries.map(({ value }) => value)).toEqual([
      "Canon",
      "Nikon",
    ]);
  });

  it("preserves unknown tag structure without inventing a value", () => {
    const result = parseTiff(
      new TiffBuilder()
        .ifd(8, [
          { tag: 0xc4a5, type: TIFF_FIELD_TYPE.SHORT, count: 1, value: 7 },
        ])
        .finish(),
      LIMITS,
    );

    expect(result.entries[0]).toMatchObject({
      tag: 0xc4a5,
      type: TIFF_FIELD_TYPE.SHORT,
      count: 1,
      name: "Tag0xC4A5",
      category: "unknown",
      privacy: "unknown",
    });
    expect(result.entries[0]).not.toHaveProperty("value");
  });

  it("keeps MakerNote opaque and does not recurse", () => {
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
          tag: TIFF_TAG.MAKER_NOTE,
          type: TIFF_FIELD_TYPE.UNDEFINED,
          count: 8,
          valueOffset: 100,
        },
      ])
      .bytes(100, [0x49, 0x49, 42, 0, 8, 0, 0, 0])
      .finish();
    const result = parseTiff(input, LIMITS);

    expect(result.entries[0]).toMatchObject({
      name: "MakerNote",
      valueLength: 8,
    });
    expect(result.entries[0]).not.toHaveProperty("value");
    expect(result.diagnostics).toEqual([]);
  });
});
