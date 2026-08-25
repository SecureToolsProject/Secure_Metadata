import { describe, expect, it } from "vitest";

import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";
import { parseTiff } from "../../src/exif/tiff.js";
import { TIFF_TAG } from "../../src/exif/tags.js";
import { TiffBuilder } from "../helpers/tiff-builder.js";

describe("TIFF total traversal limit", () => {
  it("bounds total processed entries and queued IFD targets", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.ORIENTATION,
          type: TIFF_FIELD_TYPE.SHORT,
          count: 1,
          value: 1,
        },
        {
          tag: TIFF_TAG.EXIF_IFD_POINTER,
          type: TIFF_FIELD_TYPE.LONG,
          count: 1,
          value: 80,
        },
      ])
      .ifd(80, [])
      .finish();
    const result = parseTiff(input, {
      maxIfdEntries: 4_096,
      maxIfdDepth: 16,
      maxMetadataEntries: 1,
      maxStringBytes: 4 * 1024 * 1024,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_TRAVERSAL_LIMIT_EXCEEDED" }),
    );
  });

  it("caps entries within a single IFD table", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        {
          tag: TIFF_TAG.ORIENTATION,
          type: TIFF_FIELD_TYPE.SHORT,
          count: 1,
          value: 1,
        },
        {
          tag: TIFF_TAG.ORIENTATION,
          type: TIFF_FIELD_TYPE.SHORT,
          count: 1,
          value: 2,
        },
      ])
      .finish();

    const result = parseTiff(input, {
      maxIfdEntries: 4_096,
      maxIfdDepth: 16,
      maxMetadataEntries: 1,
      maxStringBytes: 4 * 1024 * 1024,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_TRAVERSAL_LIMIT_EXCEEDED" }),
    );
  });

  it("caps diagnostics while continuing bounded TIFF work", () => {
    const input = new TiffBuilder()
      .ifd(8, [
        { tag: 1, type: 99, count: 1 },
        { tag: 2, type: 99, count: 1 },
      ])
      .finish();

    const result = parseTiff(input, {
      maxIfdEntries: 4_096,
      maxIfdDepth: 16,
      maxMetadataEntries: 10,
      maxStringBytes: 4 * 1024 * 1024,
      maxDiagnostics: 1,
    });

    expect(result.entries).toHaveLength(2);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.complete).toBe(false);
  });
});
