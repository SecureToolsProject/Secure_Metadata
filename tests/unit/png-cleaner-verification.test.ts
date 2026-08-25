import { describe, expect, it } from "vitest";

import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";
import {
  cleanMetadata,
  IncompletePngError,
  inspectMetadata,
  verifyMetadata,
} from "../../src/index.js";
import {
  chunk,
  concat,
  itxtChunk,
  png,
  PNG_SIGNATURE,
  textChunk,
  ztxtChunk,
} from "../helpers/png-builder.js";
import { TiffBuilder } from "../helpers/tiff-builder.js";

function canonicalFixture() {
  const ihdr = chunk("IHDR", new Uint8Array(13));
  const gamma = chunk("gAMA", Uint8Array.of(0, 0, 0xb1, 0x8f));
  const icc = chunk("iCCP", Uint8Array.of(0x70, 0, 0, 0x78, 0x9c));
  const text = textChunk("Author", "Ada");
  const compressedText = ztxtChunk("Comment");
  const internationalText = itxtChunk("Description", "private");
  const xmp = itxtChunk("XML:com.adobe.xmp", "packet", true);
  const exif = chunk("eXIf", new TiffBuilder().ifd(8, []).finish());
  const unknown = chunk("vpAg", Uint8Array.of(0xde, 0xad));
  const animation = [
    chunk("acTL", new Uint8Array(8)),
    chunk("fcTL", new Uint8Array(26)),
    chunk("fdAT", Uint8Array.of(0, 0, 0, 1, 0xaa)),
  ];
  const image = [
    chunk("IDAT", Uint8Array.of(1, 2, 3)),
    chunk("IDAT", Uint8Array.of(4, 5, 6)),
  ];
  const time = chunk("tIME", Uint8Array.of(7, 0xe8, 1, 2, 3, 4, 5));
  const iend = chunk("IEND");
  const trailing = Uint8Array.of(0xfa, 0xfb, 0xfc);

  return {
    input: png(
      [
        ihdr,
        gamma,
        icc,
        text,
        compressedText,
        internationalText,
        xmp,
        exif,
        unknown,
        ...animation,
        ...image,
        time,
        iend,
      ],
      trailing,
    ),
    expected: png(
      [ihdr, gamma, icc, unknown, ...animation, ...image, iend],
      trailing,
    ),
  };
}

describe("PNG Privacy Clean", () => {
  it("removes privacy chunks while preserving retained chunks, CRCs, order, APNG, IDAT, and trailing bytes exactly", () => {
    const { input, expected } = canonicalFixture();
    const before = Uint8Array.from(input);

    const first = cleanMetadata(input);
    const second = cleanMetadata(input);
    const idempotent = cleanMetadata(first.output);
    const verification = verifyMetadata(first.output, { icc: "present" });

    expect(first.output).toEqual(expected);
    expect(first.output).not.toBe(input);
    expect(input).toEqual(before);
    expect(second.output).toEqual(first.output);
    expect(idempotent.output).toEqual(first.output);
    expect(idempotent.removed).toEqual([]);
    expect(first.removed.map(({ namespace }) => namespace)).toEqual([
      "png-text",
      "png-text",
      "png-text",
      "xmp",
      "exif",
      "png-time",
    ]);
    expect(first.preserved.map(({ namespace }) => namespace)).toEqual([
      "icc",
      "unknown",
    ]);
    expect(first.report.entries.map(({ namespace }) => namespace)).toEqual([
      "icc",
    ]);
    expect(verification.valid).toBe(true);
    expect(verification.checks).toHaveLength(5);
  });

  it("returns a separate byte-identical output when there is nothing to remove", () => {
    const input = png([
      chunk("IHDR", new Uint8Array(13)),
      chunk("ABCD", Uint8Array.of(1)),
      chunk("IDAT", Uint8Array.of(2)),
      chunk("IEND"),
    ]);

    const result = cleanMetadata(input);

    expect(result.output).toEqual(input);
    expect(result.output).not.toBe(input);
    expect(result.removed).toEqual([]);
    expect(verifyMetadata(result.output).valid).toBe(true);
  });

  it("supports explicit text, timestamp, and ICC policy overrides", () => {
    const text = textChunk("Author");
    const time = chunk("tIME", new Uint8Array(7));
    const input = png([
      text,
      itxtChunk("XML:com.adobe.xmp"),
      chunk("eXIf", new TiffBuilder().ifd(8, []).finish()),
      chunk("iCCP"),
      time,
      chunk("IEND"),
    ]);

    const result = cleanMetadata(input, {
      removeTextMetadata: false,
      removeTimestamps: false,
      preserveIcc: false,
    });

    expect(result.output).toEqual(png([text, time, chunk("IEND")]));
    expect(result.removed.map(({ namespace }) => namespace)).toEqual([
      "xmp",
      "exif",
      "icc",
    ]);
    expect(result.preserved.map(({ namespace }) => namespace)).toEqual([
      "png-text",
      "png-time",
    ]);
  });

  it.each([
    PNG_SIGNATURE,
    concat(PNG_SIGNATURE, Uint8Array.of(0, 0, 0, 0, 0x49)),
    png([chunk("IDAT")]),
  ])("rejects structurally incomplete PNG without partial output", (input) => {
    expect(() => cleanMetadata(input)).toThrowError(IncompletePngError);
    expect(() => verifyMetadata(input)).toThrowError(IncompletePngError);
  });

  it("removes bounded EXIF even when its TIFF payload is malformed", () => {
    const input = png([chunk("eXIf", Uint8Array.of(0x49)), chunk("IEND")]);

    expect(inspectMetadata(input).diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_TRUNCATED_HEADER" }),
    );

    const result = cleanMetadata(input);
    expect(result.output).toEqual(png([chunk("IEND")]));
    expect(result.removed).toEqual([
      expect.objectContaining({ namespace: "exif", action: "removed" }),
    ]);
    expect(verifyMetadata(result.output).valid).toBe(true);
  });

  it("uses eXIf data byte zero as the shared TIFF origin", () => {
    const tiff = new TiffBuilder()
      .ifd(8, [
        {
          tag: 0x010f,
          type: TIFF_FIELD_TYPE.ASCII,
          count: 5,
          valueOffset: 40,
        },
      ])
      .ascii(40, "ACME")
      .finish();
    const input = png([chunk("eXIf", tiff), chunk("IEND")]);
    const report = inspectMetadata(input);
    const make = report.entries.find(({ source }) => source.tiffTag === 0x010f);

    expect(report.inspectionStatus).toBe("metadata-partial");
    expect(make).toMatchObject({ value: "ACME", namespace: "exif" });
    expect(make?.source.offset).toBe(8 + 8 + 10);
  });

  it("honors the exact supplied Uint8Array subview", () => {
    const embedded = canonicalFixture().input;
    const backing = concat(Uint8Array.of(1, 2, 3), embedded, Uint8Array.of(4));
    const view = new Uint8Array(
      backing.buffer,
      backing.byteOffset + 3,
      embedded.byteLength,
    );

    expect(cleanMetadata(view).output).toEqual(canonicalFixture().expected);
  });
});

describe("PNG verification", () => {
  it("returns precise failures for retained privacy metadata", () => {
    const result = verifyMetadata(
      png([textChunk("Author"), chunk("tIME"), chunk("IEND")]),
    );

    expect(result.valid).toBe(false);
    expect(result.checks).toContainEqual({
      namespace: "png-text",
      expected: "absent",
      actual: "present",
      passed: false,
    });
    expect(result.checks).toContainEqual({
      namespace: "png-time",
      expected: "absent",
      actual: "present",
      passed: false,
    });
  });
});
