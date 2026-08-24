import { describe, expect, it } from "vitest";

import { ByteReader } from "../../src/core/binary/byte-reader.js";
import { parseJpeg } from "../../src/jpeg/parser.js";
import {
  concat,
  EXIF,
  jpeg,
  marker,
  MARKER,
  segment,
} from "../helpers/jpeg-builder.js";

function parse(input: Uint8Array, maxSegments = 100) {
  return parseJpeg(new ByteReader(input), maxSegments);
}

function declaredSegment(
  code: number,
  declaredLength: number,
  payload: Uint8Array = new Uint8Array(),
): Uint8Array {
  return concat(
    marker(code),
    Uint8Array.of(Math.floor(declaredLength / 0x100), declaredLength % 0x100),
    payload,
  );
}

describe("malformed JPEG lengths and markers", () => {
  it.each([
    [0, "JPEG_INVALID_SEGMENT_LENGTH"],
    [1, "JPEG_INVALID_SEGMENT_LENGTH"],
  ] as const)("rejects declared segment length %i", (length, code) => {
    const result = parse(
      concat(marker(MARKER.SOI), declaredSegment(MARKER.APP1, length)),
    );

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code }),
    );
  });

  it("reports a truncated two-byte segment length", () => {
    const result = parse(concat(marker(MARKER.SOI), marker(MARKER.APP1)));

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_TRUNCATED_SEGMENT_LENGTH" }),
    );
  });

  it("reports a declared segment that extends past EOF", () => {
    const result = parse(
      concat(
        marker(MARKER.SOI),
        declaredSegment(MARKER.APP1, 8, Uint8Array.of(0x45)),
      ),
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_TRUNCATED_SEGMENT" }),
    );
  });

  it("reports a marker truncated after FF", () => {
    const result = parse(Uint8Array.of(0xff, 0xd8, 0xff));

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_TRUNCATED_MARKER" }),
    );
  });

  it.each([
    Uint8Array.of(0xff, 0xd8, 0xff, 0x00),
    Uint8Array.of(0xff, 0xd8, 0x12, 0x34),
    Uint8Array.of(0xff, 0xd8, 0xff, 0x7f),
  ])("reports invalid marker syntax without a native exception", (input) => {
    expect(() => parse(input)).not.toThrow();
    expect(parse(input).diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_INVALID_MARKER" }),
    );
  });

  it("reports invalid SOI when called directly", () => {
    const result = parse(Uint8Array.of(0, 1, 2));

    expect(result).toMatchObject({ complete: false, sawSoi: false });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_INVALID_SOI" }),
    );
  });

  it("reports a missing EOI after otherwise valid segments", () => {
    const result = parse(
      concat(marker(MARKER.SOI), segment(MARKER.APP1, EXIF)),
    );

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_MISSING_EOI" }),
    );
  });

  it("reports a scan truncated before a terminating marker", () => {
    const result = parse(
      concat(
        marker(MARKER.SOI),
        segment(MARKER.SOS),
        Uint8Array.of(1, 2, 3, 0xff, 0x00),
      ),
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_TRUNCATED_SCAN" }),
    );
  });

  it("reports scan fill bytes truncated at EOF", () => {
    const result = parse(
      concat(marker(MARKER.SOI), segment(MARKER.SOS), Uint8Array.of(1, 0xff)),
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_TRUNCATED_SCAN" }),
    );
  });

  it("enforces maxSegments across structural and restart markers", () => {
    const input = jpeg(
      segment(MARKER.SOS),
      Uint8Array.of(1, 0xff, 0xd0, 2, 0xff, 0xd1, 3),
    );
    const result = parse(input, 3);

    expect(result.complete).toBe(false);
    expect(result.segments).toHaveLength(3);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_SEGMENT_LIMIT_EXCEEDED" }),
    );
  });
});
