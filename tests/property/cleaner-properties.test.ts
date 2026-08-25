import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  cleanMetadata,
  inspectMetadata,
  SecureMetadataError,
  verifyMetadata,
  type CleaningPolicy,
} from "../../src/index.js";
import {
  concat as jpegConcat,
  EXIF,
  ICC,
  jpeg,
  MARKER,
  segment,
} from "../helpers/jpeg-builder.js";
import { chunk as pngChunk, png, textChunk } from "../helpers/png-builder.js";
import { chunk as webpChunk, vp8x, webp } from "../helpers/webp-builder.js";
import { CLEANER_PROPERTY_RUNS, propertyParameters } from "./config.js";

const POLICY = fc.constantFrom<CleaningPolicy>(
  {},
  { removeExif: false },
  { preserveIcc: false },
  { removeExif: false, preserveIcc: false },
);

function assertCommonCleanerProperties(
  input: Uint8Array,
  policy: CleaningPolicy,
  expected: Uint8Array,
): void {
  const before = Uint8Array.from(input);
  const first = cleanMetadata(input, policy);
  const second = cleanMetadata(input, policy);
  const idempotent = cleanMetadata(first.output, policy);

  expect(first.output).toEqual(expected);
  expect(second.output).toEqual(first.output);
  expect(idempotent.output).toEqual(first.output);
  expect(first.output.byteLength).toBeLessThanOrEqual(input.byteLength);
  expect(inspectMetadata(first.output).inspectionStatus).not.toBe(
    "container-partial",
  );
  expect(input).toEqual(before);
}

describe("cleaner properties", () => {
  it("preserves JPEG scan, ICC, and unknown bytes under bounded policies", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 24 }),
        fc.uint8Array({ maxLength: 24 }),
        fc.uint8Array({ maxLength: 24 }),
        fc
          .array(fc.integer({ min: 0, max: 0xfe }), { maxLength: 32 })
          .map((values) => Uint8Array.from(values)),
        POLICY,
        (iccPayload, unknownPayload, exifPayload, scan, policy) => {
          const icc = segment(MARKER.APP2, jpegConcat(ICC, iccPayload));
          const unknown = segment(0xe3, unknownPayload);
          const exif = segment(MARKER.APP1, jpegConcat(EXIF, exifPayload));
          const sos = segment(MARKER.SOS);
          const input = jpeg(icc, unknown, exif, sos, scan);
          const expected = jpeg(
            ...(policy.preserveIcc === false ? [] : [icc]),
            unknown,
            ...(policy.removeExif === false ? [exif] : []),
            sos,
            scan,
          );

          assertCommonCleanerProperties(input, policy, expected);
        },
      ),
      propertyParameters({ numRuns: CLEANER_PROPERTY_RUNS }),
    );
  });

  it("repairs only WebP RIFF/VP8X metadata bookkeeping under bounded policies", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 24 }),
        fc.uint8Array({ maxLength: 24 }),
        fc.uint8Array({ maxLength: 24 }),
        fc.uint8Array({ maxLength: 24 }),
        fc.integer({ min: 0, max: 0xff }),
        fc.constantFrom(0, 0x10, 0x02, 0x12),
        POLICY,
        (
          iccPayload,
          unknownPayload,
          exifPayload,
          imagePayload,
          paddingByte,
          unrelatedFlags,
          policy,
        ) => {
          const icc = webpChunk("ICCP", iccPayload, paddingByte);
          const unknown = webpChunk("zzZZ", unknownPayload, paddingByte);
          const exif = webpChunk("EXIF", exifPayload, paddingByte);
          const xmp = webpChunk("XMP ", Uint8Array.of(1), paddingByte);
          const image = webpChunk("VP8 ", imagePayload, paddingByte);
          const input = webp([
            vp8x(unrelatedFlags | 0x2c),
            icc,
            unknown,
            exif,
            xmp,
            image,
          ]);
          const keepIcc = policy.preserveIcc !== false;
          const keepExif = policy.removeExif === false;
          const expectedFlags =
            unrelatedFlags | (keepIcc ? 0x20 : 0) | (keepExif ? 0x08 : 0);
          const expected = webp([
            vp8x(expectedFlags),
            ...(keepIcc ? [icc] : []),
            unknown,
            ...(keepExif ? [exif] : []),
            image,
          ]);

          assertCommonCleanerProperties(input, policy, expected);
          expect(
            new DataView(expected.buffer, expected.byteOffset).getUint32(
              4,
              true,
            ) + 8,
          ).toBe(expected.byteLength);
        },
      ),
      propertyParameters({ numRuns: CLEANER_PROPERTY_RUNS }),
    );
  });

  it("preserves PNG IDAT, unknown chunks, and retained CRC bytes", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 24 }),
        fc.uint8Array({ maxLength: 24 }),
        fc.uint8Array({ maxLength: 24 }),
        fc.integer({ min: 0, max: 0xffff_ffff }),
        POLICY,
        (iccPayload, unknownPayload, imagePayload, imageCrc, policy) => {
          const icc = pngChunk("iCCP", iccPayload);
          const unknown = pngChunk("vpAg", unknownPayload);
          const exif = pngChunk("eXIf", Uint8Array.of(0x49));
          const text = textChunk("Author");
          const image = pngChunk("IDAT", imagePayload, imageCrc);
          const iend = pngChunk("IEND");
          const input = png([icc, unknown, exif, text, image, iend]);
          const expected = png([
            ...(policy.preserveIcc === false ? [] : [icc]),
            unknown,
            ...(policy.removeExif === false ? [exif] : []),
            image,
            iend,
          ]);

          assertCommonCleanerProperties(input, policy, expected);
        },
      ),
      propertyParameters({ numRuns: CLEANER_PROPERTY_RUNS }),
    );
  });

  it("preserves generated ICC payloads under the default policy", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("jpeg" as const, "webp" as const, "png" as const),
        fc.uint8Array({ maxLength: 32 }),
        (format, payload) => {
          const input =
            format === "jpeg"
              ? jpeg(segment(MARKER.APP2, jpegConcat(ICC, payload)))
              : format === "webp"
                ? webp([webpChunk("ICCP", payload)])
                : png([pngChunk("iCCP", payload), pngChunk("IEND")]);
          const result = cleanMetadata(input);

          expect(result.report.entries).toContainEqual(
            expect.objectContaining({ namespace: "icc" }),
          );
        },
      ),
      propertyParameters({ numRuns: CLEANER_PROPERTY_RUNS }),
    );
  });
});

describe("verification properties", () => {
  it("never treats incomplete or metadata-truncated observations as valid", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("jpeg" as const, "webp" as const, "png" as const),
        fc.boolean(),
        (format, truncateMetadata) => {
          if (!truncateMetadata) {
            const incomplete =
              format === "jpeg"
                ? jpeg(segment(MARKER.APP1, EXIF)).slice(0, -2)
                : format === "webp"
                  ? webp([webpChunk("EXIF")]).slice(0, -1)
                  : png([pngChunk("IDAT")]);
            try {
              const result = verifyMetadata(incomplete);
              expect(result.valid).not.toBe(true);
            } catch (error) {
              expect(error).toBeInstanceOf(SecureMetadataError);
            }
            return;
          }

          const metadataRich =
            format === "jpeg"
              ? jpeg(segment(MARKER.APP1, EXIF), segment(MARKER.APP2, ICC))
              : format === "webp"
                ? webp([webpChunk("EXIF"), webpChunk("XMP ")])
                : png([
                    textChunk("Author"),
                    pngChunk("tIME"),
                    pngChunk("IEND"),
                  ]);
          const result = verifyMetadata(metadataRich, {
            limits: { maxMetadataEntries: 1 },
          });

          expect(result.report.metadataTruncated).toBe(true);
          expect(result.valid).toBe(false);
        },
      ),
      propertyParameters({ numRuns: CLEANER_PROPERTY_RUNS }),
    );
  });
});
