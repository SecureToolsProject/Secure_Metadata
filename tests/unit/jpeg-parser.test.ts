import { describe, expect, it } from "vitest";

import { ByteReader } from "../../src/core/binary/byte-reader.js";
import { parseJpeg } from "../../src/jpeg/parser.js";
import {
  ADOBE,
  concat,
  EXIF,
  JFIF,
  JFXX,
  jpeg,
  marker,
  MARKER,
  segment,
} from "../helpers/jpeg-builder.js";

function parse(input: Uint8Array, maxSegments = 100) {
  return parseJpeg(new ByteReader(input), maxSegments);
}

describe("JPEG marker parser", () => {
  it("parses a minimal SOI/EOI container", () => {
    const result = parse(jpeg());

    expect(result).toMatchObject({
      complete: true,
      sawSoi: true,
      sawEoi: true,
    });
    expect(result.segments.map(({ markerName }) => markerName)).toEqual([
      "SOI",
      "EOI",
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("records structural, standalone, and unknown length-prefixed markers", () => {
    const input = jpeg(
      marker(0x01),
      marker(0xd0),
      segment(MARKER.DQT),
      segment(0xf0),
    );
    const result = parse(input);

    expect(
      result.segments.map(({ markerName, kind }) => [markerName, kind]),
    ).toEqual([
      ["SOI", "standalone"],
      ["TEM", "standalone"],
      ["RST0", "standalone"],
      ["DQT", "image-structure"],
      ["UNKNOWN_F0", "unknown"],
      ["EOI", "standalone"],
    ]);
  });

  it("uses declared lengths that include the two-byte length field", () => {
    const input = jpeg(
      segment(0xe3),
      segment(0xe4, Uint8Array.of(0xaa)),
      segment(0xe5, Uint8Array.of(1, 2, 3)),
    );
    const result = parse(input);
    const applications = result.segments.filter(
      ({ kind }) => kind === "application",
    );

    expect(
      applications.map(({ length, payloadLength }) => [length, payloadLength]),
    ).toEqual([
      [4, 0],
      [5, 1],
      [7, 3],
    ]);
  });

  it("handles repeated marker fill bytes", () => {
    const input = concat(
      marker(MARKER.SOI),
      segment(MARKER.APP1, EXIF, 3),
      marker(MARKER.EOI, 4),
    );
    const result = parse(input);

    expect(result.complete).toBe(true);
    expect(result.segments[1]).toMatchObject({
      markerName: "APP1",
      metadataKind: "exif",
      offset: 4,
    });
    expect(result.segments.at(-1)?.markerName).toBe("EOI");
  });

  it("classifies JFIF, JFXX, Adobe, and unknown APP payloads conservatively", () => {
    const result = parse(
      jpeg(
        segment(MARKER.APP0, JFIF),
        segment(MARKER.APP0, JFXX),
        segment(MARKER.APP14, ADOBE),
        segment(MARKER.APP1, Uint8Array.of(1, 2, 3)),
      ),
    );
    const applications = result.segments.filter(
      ({ kind }) => kind === "application",
    );

    expect(
      applications.map(({ metadataKind, metadataSubtype }) => [
        metadataKind,
        metadataSubtype,
      ]),
    ).toEqual([
      ["jfif", "jfif"],
      ["jfif", "jfxx"],
      ["adobe", undefined],
      ["unknown", undefined],
    ]);
  });

  it("does not match a payload signature across the segment boundary", () => {
    const partialExif = EXIF.slice(0, 4);
    const result = parse(
      jpeg(segment(MARKER.APP1, partialExif), segment(0xe3, EXIF.slice(4))),
    );

    expect(result.segments[1]?.metadataKind).toBe("unknown");
  });

  it("stops at EOI and reports trailing data", () => {
    const result = parse(concat(jpeg(), Uint8Array.of(1, 2, 3)));

    expect(result.complete).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "JPEG_TRAILING_DATA",
        offset: 4,
      }),
    );
  });
});

describe("JPEG scan traversal", () => {
  it("skips scan bytes and FF 00 stuffing without decoding", () => {
    const input = jpeg(
      segment(MARKER.SOS),
      Uint8Array.of(0x12, 0x34, 0xff, 0x00, 0x56, 0x78),
    );
    const result = parse(input);

    expect(result.complete).toBe(true);
    expect(result.segments.map(({ markerName }) => markerName)).toEqual([
      "SOI",
      "SOS",
      "EOI",
    ]);
  });

  it("records restart markers without terminating a scan", () => {
    const input = jpeg(
      segment(MARKER.SOS),
      Uint8Array.of(0x11, 0xff, 0xd0, 0x22, 0xff, 0xd1, 0x33),
    );
    const result = parse(input);

    expect(result.complete).toBe(true);
    expect(result.segments.map(({ markerName }) => markerName)).toEqual([
      "SOI",
      "SOS",
      "RST0",
      "RST1",
      "EOI",
    ]);
  });

  it("resumes normal traversal and supports multiple scans", () => {
    const input = jpeg(
      segment(MARKER.SOS),
      Uint8Array.of(0x11, 0x22),
      segment(MARKER.DHT),
      segment(MARKER.SOS),
      Uint8Array.of(0x33, 0xff, 0x00, 0x44),
    );
    const result = parse(input);

    expect(result.complete).toBe(true);
    expect(result.segments.map(({ markerName }) => markerName)).toEqual([
      "SOI",
      "SOS",
      "DHT",
      "SOS",
      "EOI",
    ]);
  });
});
