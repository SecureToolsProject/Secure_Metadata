import { describe, expect, it } from "vitest";

import {
  cleanMetadata,
  IncompleteJpegError,
  inspectMetadata,
  UnsupportedFormatError,
  verifyMetadata,
} from "../../src/index.js";
import {
  concat,
  EXIF,
  EXTENDED_XMP,
  ICC,
  JFIF,
  jpeg,
  marker,
  MARKER,
  PHOTOSHOP,
  segment,
  XMP,
} from "../helpers/jpeg-builder.js";
import { TiffBuilder } from "../helpers/tiff-builder.js";

function canonicalFixture() {
  const jfif = segment(MARKER.APP0, concat(JFIF, Uint8Array.of(1, 2)), 2);
  const exif = segment(
    MARKER.APP1,
    concat(EXIF, new TiffBuilder().ifd(8, []).finish(14)),
    3,
  );
  const xmp = segment(MARKER.APP1, concat(XMP, Uint8Array.of(0x78)));
  const extendedXmp = segment(
    MARKER.APP1,
    concat(EXTENDED_XMP, Uint8Array.of(0x79)),
  );
  const secondExif = segment(
    MARKER.APP1,
    concat(EXIF, new TiffBuilder("big").ifd(8, []).finish(14)),
  );
  const icc = segment(MARKER.APP2, concat(ICC, Uint8Array.of(1, 1, 0xaa)));
  const unknown = segment(0xe3, Uint8Array.of(0xde, 0xad, 0xbe, 0xef));
  const comment = segment(MARKER.COM, Uint8Array.of(0x80, 0x00), 2);
  const dqt = segment(MARKER.DQT, Uint8Array.of(0x01, 0x02));
  const firstSos = segment(MARKER.SOS, Uint8Array.of(0x01));
  const firstScan = Uint8Array.of(0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x33);
  const iptc = segment(MARKER.APP13, concat(PHOTOSHOP, Uint8Array.of(0x44)));
  const dht = segment(MARKER.DHT, Uint8Array.of(0x55));
  const secondSos = segment(MARKER.SOS, Uint8Array.of(0x02));
  const secondScan = Uint8Array.of(0x66, 0xff, 0x00, 0x77);
  const trailing = Uint8Array.of(0xfa, 0xfb);

  return {
    input: concat(
      jpeg(
        jfif,
        exif,
        xmp,
        icc,
        unknown,
        extendedXmp,
        secondExif,
        comment,
        dqt,
        firstSos,
        firstScan,
        iptc,
        dht,
        secondSos,
        secondScan,
      ),
      trailing,
    ),
    expected: concat(
      jpeg(
        jfif,
        icc,
        unknown,
        dqt,
        firstSos,
        firstScan,
        dht,
        secondSos,
        secondScan,
      ),
      trailing,
    ),
  };
}

describe("JPEG Privacy Clean", () => {
  it("removes every targeted container while preserving retained bytes, scans, ordering, and trailing data", () => {
    const { input, expected } = canonicalFixture();
    const before = Uint8Array.from(input);

    const first = cleanMetadata(input);
    const second = cleanMetadata(input);
    const idempotent = cleanMetadata(first.output);
    const verification = verifyMetadata(first.output, { icc: "present" });

    expect(first.output).toEqual(expected);
    expect(first.output).not.toBe(input);
    expect(first.output.byteLength).toBeLessThan(input.byteLength);
    expect(input).toEqual(before);
    expect(second.output).toEqual(first.output);
    expect(idempotent.output).toEqual(first.output);
    expect(idempotent.removed).toEqual([]);
    expect(first.removed.map(({ namespace }) => namespace)).toEqual([
      "exif",
      "xmp",
      "xmp",
      "exif",
      "jpeg-comment",
      "iptc",
    ]);
    expect(first.preserved.map(({ namespace }) => namespace)).toEqual([
      "container",
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
    const input = jpeg(
      segment(MARKER.APP0, JFIF),
      segment(MARKER.APP2, ICC),
      segment(0xe4, Uint8Array.of(1, 2, 3)),
    );

    const result = cleanMetadata(input);

    expect(result.output).toEqual(input);
    expect(result.output).not.toBe(input);
    expect(result.removed).toEqual([]);
    expect(verifyMetadata(result.output).valid).toBe(true);
  });

  it("supports one explicit custom policy without inferring unknown removal", () => {
    const xmp = segment(MARKER.APP1, XMP);
    const comment = segment(MARKER.COM, Uint8Array.of(1, 2));
    const input = jpeg(
      segment(MARKER.APP1, EXIF),
      xmp,
      segment(MARKER.APP2, ICC),
      segment(0xe3, Uint8Array.of(3, 4)),
      comment,
    );

    const result = cleanMetadata(input, {
      removeXmp: false,
      removeComments: false,
      preserveIcc: false,
    });

    expect(result.output).toEqual(
      jpeg(xmp, segment(0xe3, Uint8Array.of(3, 4)), comment),
    );
    expect(result.removed.map(({ namespace }) => namespace)).toEqual([
      "exif",
      "icc",
    ]);
    expect(result.preserved.map(({ namespace }) => namespace)).toEqual([
      "xmp",
      "unknown",
      "jpeg-comment",
    ]);
  });

  it.each([
    concat(marker(MARKER.SOI), marker(MARKER.APP1)),
    concat(
      marker(MARKER.SOI),
      segment(MARKER.SOS),
      Uint8Array.of(1, 0xff, 0x00),
    ),
  ])("rejects structurally incomplete JPEG without partial output", (input) => {
    expect(() => cleanMetadata(input)).toThrowError(IncompleteJpegError);
    expect(() => cleanMetadata(input)).toThrowError(
      expect.objectContaining({ code: "INCOMPLETE_JPEG" }),
    );
  });

  it("removes structurally bounded EXIF even when its TIFF payload is malformed", () => {
    const input = jpeg(segment(MARKER.APP1, concat(EXIF, Uint8Array.of(0x49))));

    expect(inspectMetadata(input).diagnostics).toContainEqual(
      expect.objectContaining({ code: "TIFF_TRUNCATED_HEADER" }),
    );

    const result = cleanMetadata(input);

    expect(result.output).toEqual(jpeg());
    expect(result.removed).toEqual([
      expect.objectContaining({ namespace: "exif", action: "removed" }),
    ]);
    expect(verifyMetadata(result.output).valid).toBe(true);
  });

  it("honors the exact supplied Uint8Array subview", () => {
    const embedded = canonicalFixture().input;
    const prefix = Uint8Array.of(0xaa, 0xbb, 0xcc);
    const suffix = Uint8Array.of(0xdd, 0xee);
    const backing = concat(prefix, embedded, suffix);
    const view = new Uint8Array(
      backing.buffer,
      backing.byteOffset + prefix.byteLength,
      embedded.byteLength,
    );

    expect(cleanMetadata(view).output).toEqual(canonicalFixture().expected);
  });
});

describe("JPEG verification", () => {
  it("returns a precise failed check when an expected-absent container remains", () => {
    const result = verifyMetadata(jpeg(segment(MARKER.APP1, XMP)));

    expect(result.valid).toBe(false);
    expect(result.checks).toContainEqual({
      namespace: "xmp",
      expected: "absent",
      actual: "present",
      passed: false,
    });
  });

  it.each([[new Uint8Array(), "unknown"]] as const)(
    "rejects unsupported $format cleaning and verification",
    (input, format) => {
      for (const operation of [cleanMetadata, verifyMetadata]) {
        expect(() => operation(input)).toThrowError(UnsupportedFormatError);
        expect(() => operation(input)).toThrowError(
          expect.objectContaining({
            code: "UNSUPPORTED_FORMAT",
            format,
          }),
        );
      }
    },
  );
});
