import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ByteReader } from "../../src/core/binary/byte-reader.js";
import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";
import { TIFF_TAG } from "../../src/exif/tags.js";
import { parseTiff, type TiffParseLimits } from "../../src/exif/tiff.js";
import {
  cleanMetadata,
  inspectMetadata,
  SecureMetadataError,
} from "../../src/index.js";
import { parseJpeg } from "../../src/jpeg/parser.js";
import { parsePng } from "../../src/png/parser.js";
import { parseWebP } from "../../src/webp/parser.js";
import {
  concat as jpegConcat,
  EXIF,
  jpeg,
  MARKER,
  segment,
} from "../helpers/jpeg-builder.js";
import { chunk as pngChunk, png, textChunk } from "../helpers/png-builder.js";
import { TiffBuilder } from "../helpers/tiff-builder.js";
import {
  chunk as webpChunk,
  webp,
  withRiffSize,
} from "../helpers/webp-builder.js";
import { MAX_PROPERTY_BYTES, propertyParameters } from "./config.js";

function expectTypedFailure(operation: () => unknown): void {
  try {
    operation();
    expect.fail("Expected a typed library failure.");
  } catch (error) {
    expect(error).toBeInstanceOf(SecureMetadataError);
    expect(error).not.toBeInstanceOf(RangeError);
    expect(error).not.toBeInstanceOf(TypeError);
  }
}

function mutateJpeg(payload: Uint8Array, mutation: number): Uint8Array {
  const input = jpeg(segment(MARKER.APP1, jpegConcat(EXIF, payload)));
  if (mutation === 0) {
    return input.slice(0, -2);
  }
  const output = Uint8Array.from(input);
  if (mutation === 1) {
    output[4] = 0xff;
    output[5] = 0xff;
  } else {
    return input.slice(0, 5);
  }
  return output;
}

function mutateWebP(payload: Uint8Array, mutation: number): Uint8Array {
  const input = webp([webpChunk("EXIF", payload)]);
  if (mutation === 0) {
    return withRiffSize(input, 0xffff_ffff);
  }
  if (mutation === 1) {
    return input.slice(0, -1);
  }
  const output = Uint8Array.from(input);
  output.fill(0xff, 16, 20);
  return output;
}

function mutatePng(payload: Uint8Array, mutation: number): Uint8Array {
  const input = png([pngChunk("IDAT", payload), pngChunk("IEND")]);
  if (mutation === 0) {
    return input.slice(0, -12);
  }
  if (mutation === 1) {
    const output = Uint8Array.from(input);
    output.fill(0xff, 8, 12);
    return output;
  }
  return input.slice(0, -2);
}

const TIFF_LIMITS: TiffParseLimits = {
  maxIfdEntries: 16,
  maxIfdDepth: 4,
  maxMetadataEntries: 16,
  maxStringBytes: 128,
  maxDiagnostics: 4,
};

function malformedTiff(
  order: "little" | "big",
  mode:
    "offset" | "count" | "pointer" | "cycle" | "rational" | "type" | "maker",
  makerPayload: Uint8Array,
): Uint8Array {
  if (mode === "cycle") {
    return new TiffBuilder(order).ifd(8, [], 8).finish();
  }
  if (mode === "pointer") {
    return new TiffBuilder(order)
      .ifd(8, [
        {
          tag: TIFF_TAG.EXIF_IFD_POINTER,
          type: TIFF_FIELD_TYPE.LONG,
          count: 1,
          value: 900,
        },
      ])
      .finish();
  }
  if (mode === "rational" || mode === "maker") {
    const builder = new TiffBuilder(order).ifd(8, [
      {
        tag: TIFF_TAG.EXIF_IFD_POINTER,
        type: TIFF_FIELD_TYPE.LONG,
        count: 1,
        value: 40,
      },
    ]);
    if (mode === "maker") {
      return builder
        .ifd(40, [
          {
            tag: TIFF_TAG.MAKER_NOTE,
            type: TIFF_FIELD_TYPE.UNDEFINED,
            count: makerPayload.byteLength,
            valueOffset: 100,
          },
        ])
        .bytes(100, makerPayload)
        .finish();
    }
    return builder
      .ifd(40, [
        {
          tag: TIFF_TAG.EXPOSURE_TIME,
          type: TIFF_FIELD_TYPE.RATIONAL,
          count: 1,
          valueOffset: 100,
        },
      ])
      .rational(100, [[1, 0]])
      .finish();
  }
  if (mode === "type") {
    return new TiffBuilder(order)
      .ifd(8, [{ tag: TIFF_TAG.MAKE, type: 99, count: 1 }])
      .finish();
  }
  return new TiffBuilder(order)
    .ifd(8, [
      {
        tag: TIFF_TAG.MAKE,
        type: TIFF_FIELD_TYPE.ASCII,
        count: mode === "count" ? 0xffff_ffff : 8,
        valueOffset: mode === "count" ? 100 : 900,
      },
    ])
    .finish();
}
describe("inspection properties", () => {
  it("contains arbitrary-byte failures and preserves deterministic bounded reports", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: MAX_PROPERTY_BYTES }),
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 0, max: 4 }),
        (input, maxDiagnostics, maxMetadataEntries) => {
          const before = Uint8Array.from(input);
          const options = {
            limits: {
              maxInputBytes: MAX_PROPERTY_BYTES,
              maxDiagnostics,
              maxMetadataEntries,
            },
          };
          const first = inspectMetadata(input, options);
          const second = inspectMetadata(input, options);

          expect(first).toEqual(second);
          expect(first.diagnostics.length).toBeLessThanOrEqual(maxDiagnostics);
          expect(first.entries.length).toBeLessThanOrEqual(maxMetadataEntries);
          expect(input).toEqual(before);
        },
      ),
      propertyParameters(),
    );
  });

  it("isolates arbitrary Uint8Array subviews from prefix and suffix bytes", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 16 }),
        fc.uint8Array({ maxLength: 256 }),
        fc.uint8Array({ maxLength: 16 }),
        (prefix, payload, suffix) => {
          const backing = new Uint8Array(
            prefix.byteLength + payload.byteLength + suffix.byteLength,
          );
          backing.set(prefix, 0);
          backing.set(payload, prefix.byteLength);
          backing.set(suffix, prefix.byteLength + payload.byteLength);
          const view = new Uint8Array(
            backing.buffer,
            prefix.byteLength,
            payload.byteLength,
          );

          expect(inspectMetadata(view)).toEqual(
            inspectMetadata(Uint8Array.from(payload)),
          );
        },
      ),
      propertyParameters(),
    );
  });

  it("keeps generated metadata reports within maxMetadataEntries", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 7 }),
        (entryCount, requestedLimit) => {
          const maxMetadataEntries = Math.min(requestedLimit, entryCount - 1);
          const input = png([
            ...Array.from({ length: entryCount }, (_, index) =>
              textChunk(`K${String(index)}`),
            ),
            pngChunk("IEND"),
          ]);
          const report = inspectMetadata(input, {
            limits: { maxMetadataEntries },
          });

          expect(report.entries).toHaveLength(maxMetadataEntries);
          expect(report.metadataTruncated).toBe(true);
        },
      ),
      propertyParameters(),
    );
  });
});

describe("format parser properties", () => {
  it("rejects generated incomplete JPEG structures without partial cleaning", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 64 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 3 }),
        (payload, mutation, maxDiagnostics) => {
          const input = mutateJpeg(payload, mutation);
          const before = Uint8Array.from(input);
          const first = parseJpeg(new ByteReader(input), 32, maxDiagnostics);
          const second = parseJpeg(new ByteReader(input), 32, maxDiagnostics);

          expect(first).toEqual(second);
          expect(first.complete).toBe(false);
          expect(first.diagnostics.length).toBeLessThanOrEqual(maxDiagnostics);
          expectTypedFailure(() => cleanMetadata(input));
          expect(input).toEqual(before);
        },
      ),
      propertyParameters(),
    );
  });

  it("rejects generated incomplete WebP structures without partial cleaning", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 64 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 3 }),
        (payload, mutation, maxDiagnostics) => {
          const input = mutateWebP(payload, mutation);
          const before = Uint8Array.from(input);
          const first = parseWebP(new ByteReader(input), 32, maxDiagnostics);
          const second = parseWebP(new ByteReader(input), 32, maxDiagnostics);

          expect(first).toEqual(second);
          expect(first.complete).toBe(false);
          expect(first.diagnostics.length).toBeLessThanOrEqual(maxDiagnostics);
          expectTypedFailure(() => cleanMetadata(input));
          expect(input).toEqual(before);
        },
      ),
      propertyParameters(),
    );
  });

  it("rejects generated incomplete PNG structures without partial cleaning", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 64 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 3 }),
        (payload, mutation, maxDiagnostics) => {
          const input = mutatePng(payload, mutation);
          const before = Uint8Array.from(input);
          const first = parsePng(
            new ByteReader(input),
            32,
            128,
            maxDiagnostics,
          );
          const second = parsePng(
            new ByteReader(input),
            32,
            128,
            maxDiagnostics,
          );

          expect(first).toEqual(second);
          expect(first.complete).toBe(false);
          expect(first.diagnostics.length).toBeLessThanOrEqual(maxDiagnostics);
          expectTypedFailure(() => cleanMetadata(input));
          expect(input).toEqual(before);
        },
      ),
      propertyParameters(),
    );
  });

  it("bounds generated TIFF counts, offsets, pointers, cycles, types, and values", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("little" as const, "big" as const),
        fc.constantFrom(
          "offset" as const,
          "count" as const,
          "pointer" as const,
          "cycle" as const,
          "rational" as const,
          "type" as const,
          "maker" as const,
        ),
        fc.uint8Array({ minLength: 5, maxLength: 16 }),
        fc.integer({ min: 0, max: 4 }),
        (order, mode, makerPayload, maxDiagnostics) => {
          const input = malformedTiff(order, mode, makerPayload);
          const before = Uint8Array.from(input);
          const limits = { ...TIFF_LIMITS, maxDiagnostics };
          const first = parseTiff(input, limits);
          const second = parseTiff(input, limits);

          expect(first).toEqual(second);
          if (mode === "maker") {
            expect(first.complete).toBe(true);
            expect(first.entries).toContainEqual(
              expect.objectContaining({ name: "MakerNote" }),
            );
            expect(first.entries[0]).not.toHaveProperty("value");
          } else {
            expect(first.complete).toBe(false);
          }
          expect(first.diagnostics.length).toBeLessThanOrEqual(maxDiagnostics);
          expect(input).toEqual(before);
        },
      ),
      propertyParameters(),
    );
  });
});
