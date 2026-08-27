import fc from "fast-check";
import { expect, it } from "vitest";

import { cleanMetadata, verifyMetadata } from "../../src/index.js";
import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";
import { TIFF_TAG } from "../../src/exif/tags.js";
import {
  concat,
  EXIF,
  jpeg,
  MARKER,
  segment,
} from "../helpers/jpeg-builder.js";
import { TiffBuilder, type TestByteOrder } from "../helpers/tiff-builder.js";
import { CLEANER_PROPERTY_RUNS, propertyParameters } from "./config.js";

function exifWithPrivateSuffix(
  order: TestByteOrder,
  orientation: number,
  suffix: Uint8Array,
): Uint8Array {
  const tiff = new TiffBuilder(order, 160)
    .bytes(120, suffix)
    .ifd(8, [
      {
        tag: TIFF_TAG.ORIENTATION,
        type: TIFF_FIELD_TYPE.SHORT,
        count: 1,
        value: orientation,
      },
      {
        tag: TIFF_TAG.MAKE,
        type: TIFF_FIELD_TYPE.UNDEFINED,
        count: suffix.byteLength,
        valueOffset: 120,
      },
    ])
    .finish(120 + suffix.byteLength);
  return segment(MARKER.APP1, concat(EXIF, tiff));
}

it("property: preserves valid Orientation while removing generated private EXIF", () => {
  fc.assert(
    fc.property(
      fc.constantFrom<TestByteOrder>("little", "big"),
      fc.integer({ min: 1, max: 8 }),
      fc.uint8Array({ minLength: 1, maxLength: 24 }),
      fc
        .array(fc.integer({ min: 0, max: 0xfe }), { maxLength: 32 })
        .map((values) => Uint8Array.from(values)),
      (order, orientation, privateBytes, scan) => {
        const sos = segment(MARKER.SOS);
        const input = jpeg(
          exifWithPrivateSuffix(order, orientation, privateBytes),
          sos,
          scan,
        );

        const first = cleanMetadata(input);
        const second = cleanMetadata(first.output);

        expect(first.report.entries).toContainEqual(
          expect.objectContaining({ name: "Orientation", value: orientation }),
        );
        expect(first.report.entries.map(({ name }) => name)).not.toContain(
          "Make",
        );
        expect(first.output.slice(-scan.byteLength - 2, -2)).toEqual(scan);
        expect(second.output).toEqual(first.output);
        expect(verifyMetadata(first.output).valid).toBe(true);
      },
    ),
    propertyParameters({ numRuns: CLEANER_PROPERTY_RUNS }),
  );
});
