import { describe, expect, it } from "vitest";

import {
  cleanMetadata,
  inspectMetadata,
  verifyMetadata,
} from "../../src/index.js";
import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";
import { TIFF_TAG } from "../../src/exif/tags.js";
import {
  concat,
  EXIF,
  ICC,
  jpeg,
  MARKER,
  segment,
} from "../helpers/jpeg-builder.js";
import {
  TiffBuilder,
  type TestByteOrder,
  type TestIfdEntry,
} from "../helpers/tiff-builder.js";

const SCAN = Uint8Array.of(0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x33);

function orientationTiff(
  value: number,
  order: TestByteOrder,
  withPrivateTags = false,
): Uint8Array {
  const builder = new TiffBuilder(order, 160);
  const entries: TestIfdEntry[] = [
    {
      tag: TIFF_TAG.ORIENTATION,
      type: TIFF_FIELD_TYPE.SHORT,
      count: 1,
      value,
    },
  ];
  if (withPrivateTags) {
    entries.push(
      {
        tag: TIFF_TAG.MAKE,
        type: TIFF_FIELD_TYPE.ASCII,
        count: 12,
        valueOffset: 100,
      },
      {
        tag: TIFF_TAG.SOFTWARE,
        type: TIFF_FIELD_TYPE.ASCII,
        count: 14,
        valueOffset: 120,
      },
    );
    builder.ascii(100, "PrivateMake").ascii(120, "PrivateEditor");
  }
  return builder.ifd(8, entries).finish(withPrivateTags ? 134 : 26);
}

function orientationExif(
  value: number,
  order: TestByteOrder,
  withPrivateTags = false,
): Uint8Array {
  return segment(
    MARKER.APP1,
    concat(EXIF, orientationTiff(value, order, withPrivateTags)),
  );
}

describe("JPEG EXIF Orientation preservation", () => {
  it.each(
    (["little", "big"] as const).flatMap((order) =>
      Array.from({ length: 8 }, (_, index) => [order, index + 1] as const),
    ),
  )(
    "preserves %s-endian EXIF Orientation %i and strips other EXIF",
    (order, value) => {
      const icc = segment(MARKER.APP2, concat(ICC, Uint8Array.of(1, 1, 0xaa)));
      const unknown = segment(0xe3, Uint8Array.of(0xde, 0xad, 0xbe, 0xef));
      const sos = segment(MARKER.SOS, Uint8Array.of(1));
      const trailing = Uint8Array.of(0xfa, 0xfb);
      const input = concat(
        jpeg(orientationExif(value, order, true), icc, unknown, sos, SCAN),
        trailing,
      );
      const before = Uint8Array.from(input);

      const first = cleanMetadata(input);
      const second = cleanMetadata(first.output);

      expect(first.output).toEqual(
        concat(
          jpeg(orientationExif(value, order), icc, unknown, sos, SCAN),
          trailing,
        ),
      );
      expect(input).toEqual(before);
      expect(second.output).toEqual(first.output);
      expect(second.removed).toEqual([]);
      expect(first.removed).toContainEqual(
        expect.objectContaining({ namespace: "exif", action: "removed" }),
      );
      expect(first.preserved).toContainEqual(
        expect.objectContaining({
          namespace: "exif",
          name: "EXIF Orientation",
          action: "preserved",
        }),
      );
      expect(first.report.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "EXIF Orientation container",
            category: "rendering",
            privacy: "non-sensitive",
          }),
          expect.objectContaining({
            name: "Orientation",
            value,
            category: "rendering",
            privacy: "non-sensitive",
          }),
        ]),
      );
      expect(first.report.entries.map(({ name }) => name)).not.toContain(
        "Make",
      );
      expect(first.report.entries.map(({ name }) => name)).not.toContain(
        "Software",
      );
      expect(verifyMetadata(first.output, { icc: "present" }).valid).toBe(true);
    },
  );

  it("does not treat Orientation plus another EXIF tag as verified clean", () => {
    const input = jpeg(orientationExif(6, "little", true));

    const verification = verifyMetadata(input);

    expect(verification.valid).toBe(false);
    expect(verification.checks).toContainEqual({
      namespace: "exif",
      expected: "absent",
      actual: "present",
      passed: false,
    });
  });

  it.each([
    ["zero", orientationExif(0, "little")],
    ["out of range", orientationExif(9, "big")],
    [
      "wrong type",
      segment(
        MARKER.APP1,
        concat(
          EXIF,
          new TiffBuilder()
            .ifd(8, [
              {
                tag: TIFF_TAG.ORIENTATION,
                type: TIFF_FIELD_TYPE.LONG,
                count: 1,
                value: 6,
              },
            ])
            .finish(26),
        ),
      ),
    ],
    [
      "wrong count",
      segment(
        MARKER.APP1,
        concat(
          EXIF,
          new TiffBuilder()
            .ifd(8, [
              {
                tag: TIFF_TAG.ORIENTATION,
                type: TIFF_FIELD_TYPE.SHORT,
                count: 2,
                value: [1, 6],
              },
            ])
            .finish(26),
        ),
      ),
    ],
  ])("removes %s Orientation instead of guessing", (_name, exif) => {
    const result = cleanMetadata(jpeg(exif));

    expect(result.output).toEqual(jpeg());
    expect(result.preserved).not.toContainEqual(
      expect.objectContaining({ name: "EXIF Orientation" }),
    );
    expect(verifyMetadata(result.output).valid).toBe(true);
  });

  it("removes ambiguous duplicate Orientation containers", () => {
    const result = cleanMetadata(
      jpeg(orientationExif(6, "little"), orientationExif(8, "big")),
    );

    expect(result.output).toEqual(jpeg());
    expect(result.removed).toHaveLength(2);
    expect(verifyMetadata(result.output).valid).toBe(true);
  });

  it("inspection distinguishes canonical Orientation-only EXIF", () => {
    const report = inspectMetadata(jpeg(orientationExif(6, "little")));

    expect(report.entries.map(({ name }) => name)).toEqual([
      "EXIF Orientation container",
      "Orientation",
    ]);
    expect(verifyMetadata(jpeg(orientationExif(6, "little"))).valid).toBe(true);
  });
});
