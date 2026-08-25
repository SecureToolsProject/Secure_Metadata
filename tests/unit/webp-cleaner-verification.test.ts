import { describe, expect, it } from "vitest";

import {
  cleanMetadata,
  IncompleteWebPError,
  inspectMetadata,
  verifyMetadata,
} from "../../src/index.js";
import {
  chunk,
  concat,
  fourCC,
  u32le,
  vp8x,
  webp,
  withRiffSize,
} from "../helpers/webp-builder.js";

function canonicalFixture() {
  const trailing = Uint8Array.of(0xfa, 0xfb, 0xfc);
  const remainingVp8x = Uint8Array.of(9, 8, 7, 6, 5, 4, 3, 2, 1);
  const extended = vp8x(0x3e, remainingVp8x);
  const repairedExtended = vp8x(0x32, remainingVp8x);
  const icc = chunk("ICCP", Uint8Array.of(0x10, 0x11, 0x12), 0x7f);
  const exif = chunk("EXIF", Uint8Array.of(0x49), 0xee);
  const xmp = chunk("XMP ", Uint8Array.of(1, 2, 3), 0xdd);
  const unknown = chunk("zzZZ", Uint8Array.of(4, 5, 6, 7, 8), 0xab);
  const animation = chunk("ANIM", Uint8Array.of(9, 10));
  const frame = chunk("ANMF", Uint8Array.of(11, 12, 13), 0xbc);
  const image = chunk("VP8 ", Uint8Array.of(14, 15));
  const secondExif = chunk("EXIF", Uint8Array.of(16, 17));

  return {
    input: webp(
      [extended, icc, exif, xmp, unknown, animation, frame, secondExif, image],
      trailing,
    ),
    expected: webp(
      [repairedExtended, icc, unknown, animation, frame, image],
      trailing,
    ),
    trailing,
  };
}

describe("WebP Privacy Clean", () => {
  it("repairs only WebP bookkeeping while preserving retained chunks and padding exactly", () => {
    const { input, expected, trailing } = canonicalFixture();
    const before = Uint8Array.from(input);

    const inspected = inspectMetadata(input);
    const first = cleanMetadata(input);
    const second = cleanMetadata(input);
    const idempotent = cleanMetadata(first.output);
    const verification = verifyMetadata(first.output, { icc: "present" });

    expect(inspected).toMatchObject({
      format: "webp",
      inspectionStatus: "container-inspected",
    });
    expect(first.output).toEqual(expected);
    expect(first.output).not.toBe(input);
    expect(input).toEqual(before);
    expect(second.output).toEqual(first.output);
    expect(idempotent.output).toEqual(first.output);
    expect(idempotent.removed).toEqual([]);
    expect(first.removed.map(({ namespace }) => namespace)).toEqual([
      "exif",
      "xmp",
      "exif",
    ]);
    expect(first.preserved.map(({ namespace }) => namespace)).toEqual([
      "icc",
      "unknown",
    ]);
    expect(first.report.entries.map(({ namespace }) => namespace)).toEqual([
      "icc",
    ]);
    expect(verification.valid).toBe(true);
    expect(verification.checks).toHaveLength(3);
    expect(new DataView(first.output.buffer).getUint32(4, true) + 8).toBe(
      first.output.byteLength - trailing.byteLength,
    );
  });

  it("cleans metadata without synthesizing VP8X", () => {
    const image = chunk("VP8L", Uint8Array.of(1, 2, 3), 0x9a);
    const input = webp([chunk("EXIF", Uint8Array.of(4)), image]);

    const result = cleanMetadata(input);

    expect(result.output).toEqual(webp([image]));
    expect(result.report.entries).toEqual([]);
  });

  it("supports one custom policy and aligns VP8X flags with retained metadata", () => {
    const extended = vp8x(0x2c);
    const exif = chunk("EXIF", Uint8Array.of(1));
    const xmp = chunk("XMP ", Uint8Array.of(2));
    const icc = chunk("ICCP", Uint8Array.of(3));
    const input = webp([extended, exif, xmp, icc]);

    const result = cleanMetadata(input, { removeExif: false });

    expect(result.output).toEqual(webp([vp8x(0x28), exif, icc]));
    expect(result.removed.map(({ namespace }) => namespace)).toEqual(["xmp"]);
    expect(result.report.entries.map(({ namespace }) => namespace)).toEqual([
      "exif",
      "icc",
    ]);
  });

  it("returns a separate byte-identical output for an already consistent no-op", () => {
    const input = webp([chunk("VP8 ", Uint8Array.of(1, 2))]);

    const result = cleanMetadata(input);

    expect(result.output).toEqual(input);
    expect(result.output).not.toBe(input);
    expect(result.removed).toEqual([]);
    expect(verifyMetadata(result.output).valid).toBe(true);
  });

  it("removes malformed EXIF payload because its chunk boundary is valid", () => {
    const input = webp([chunk("EXIF", Uint8Array.of(0x49))]);

    expect(inspectMetadata(input).entries).toEqual([
      expect.objectContaining({ namespace: "exif" }),
    ]);
    const result = cleanMetadata(input);

    expect(result.output).toEqual(webp([]));
    expect(verifyMetadata(result.output).valid).toBe(true);
  });

  it("honors the exact supplied Uint8Array subview without leaking backing bytes", () => {
    const fixture = canonicalFixture();
    const prefix = Uint8Array.of(0xaa, 0xbb);
    const suffix = Uint8Array.of(0xcc, 0xdd, 0xee);
    const backing = concat(prefix, fixture.input, suffix);
    const view = new Uint8Array(
      backing.buffer,
      backing.byteOffset + prefix.byteLength,
      fixture.input.byteLength,
    );

    expect(cleanMetadata(view).output).toEqual(fixture.expected);
  });

  it.each([
    withRiffSize(webp([]), 100),
    webp([concat(fourCC("EXIF"), u32le(5), Uint8Array.of(1))]),
    webp([vp8x(0), vp8x(0)]),
  ])("rejects incomplete WebP without producing partial output", (input) => {
    expect(inspectMetadata(input).inspectionStatus).toBe("container-partial");
    expect(() => cleanMetadata(input)).toThrowError(IncompleteWebPError);
    expect(() => cleanMetadata(input)).toThrowError(
      expect.objectContaining({ code: "INCOMPLETE_WEBP" }),
    );
  });
});

describe("WebP verification", () => {
  it("reports a precise failure when EXIF remains", () => {
    const result = verifyMetadata(webp([chunk("EXIF")]));

    expect(result.valid).toBe(false);
    expect(result.checks).toContainEqual({
      namespace: "exif",
      expected: "absent",
      actual: "present",
      passed: false,
    });
    expect(result.checks.map(({ namespace }) => namespace)).toEqual([
      "exif",
      "xmp",
    ]);
  });
});
