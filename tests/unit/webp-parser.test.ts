import { describe, expect, it } from "vitest";

import { ByteReader } from "../../src/core/binary/byte-reader.js";
import { parseWebP } from "../../src/webp/parser.js";
import {
  chunk,
  concat,
  fourCC,
  u32le,
  vp8x,
  webp,
  withRiffSize,
} from "../helpers/webp-builder.js";

function parse(input: Uint8Array, maxChunks = 100) {
  return parseWebP(new ByteReader(input), maxChunks);
}

describe("WebP RIFF parser", () => {
  it("classifies known chunks, retains exact FourCC spaces, and bounds trailing data", () => {
    const trailing = Uint8Array.of(0xfa, 0xfb);
    const input = webp(
      [
        vp8x(0x3e),
        chunk("ICCP", Uint8Array.of(1)),
        chunk("EXIF", Uint8Array.of(2, 3)),
        chunk("XMP ", Uint8Array.of(4)),
        chunk("VP8 ", Uint8Array.of(5, 6)),
        chunk("VP8L", Uint8Array.of(7)),
        chunk("ALPH", Uint8Array.of(8)),
        chunk("ANIM", Uint8Array.of(9, 10)),
        chunk("ANMF", Uint8Array.of(11)),
        chunk("zzZZ", Uint8Array.of(12, 13, 14), 0x7f),
      ],
      trailing,
    );

    const result = parse(input);

    expect(result.complete).toBe(true);
    expect(result.containerLength).toBe(input.byteLength - trailing.byteLength);
    expect(
      result.chunks.map(({ fourCC: type, kind, metadataKind }) => [
        type,
        kind,
        metadataKind,
      ]),
    ).toEqual([
      ["VP8X", "extended", undefined],
      ["ICCP", "metadata", "icc"],
      ["EXIF", "metadata", "exif"],
      ["XMP ", "metadata", "xmp"],
      ["VP8 ", "image", undefined],
      ["VP8L", "image", undefined],
      ["ALPH", "alpha", undefined],
      ["ANIM", "animation", undefined],
      ["ANMF", "animation", undefined],
      ["zzZZ", "unknown", undefined],
    ]);
    expect(result.chunks.at(-1)).toMatchObject({
      payloadLength: 3,
      totalLength: 12,
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "WEBP_TRAILING_DATA" }),
    ]);
  });

  it("reports inconsistent metadata flags without treating chunks as absent", () => {
    const result = parse(webp([vp8x(0), chunk("EXIF")]));

    expect(result.complete).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "WEBP_INCONSISTENT_FEATURE_FLAGS",
      }),
    );
  });

  it.each([
    [new Uint8Array(11), "WEBP_INVALID_RIFF_HEADER"],
    [
      concat(fourCC("NOPE"), u32le(4), fourCC("WEBP")),
      "WEBP_INVALID_RIFF_HEADER",
    ],
    [
      concat(fourCC("RIFF"), u32le(4), fourCC("NOPE")),
      "WEBP_INVALID_RIFF_HEADER",
    ],
    [withRiffSize(webp([]), 3), "WEBP_INVALID_RIFF_SIZE"],
    [withRiffSize(webp([]), 100), "WEBP_TRUNCATED_RIFF"],
    [webp([Uint8Array.of(1, 2, 3, 4)]), "WEBP_TRUNCATED_CHUNK_HEADER"],
    [
      webp([concat(fourCC("EXIF"), u32le(5), Uint8Array.of(1, 2))]),
      "WEBP_TRUNCATED_CHUNK",
    ],
    [
      webp([concat(fourCC("XMP "), u32le(1), Uint8Array.of(1))]),
      "WEBP_INVALID_PADDING",
    ],
    [chunk("VP8X", Uint8Array.of(1)), "WEBP_INVALID_VP8X", true],
    [concat(vp8x(0), vp8x(0)), "WEBP_DUPLICATE_VP8X", true],
  ] as const)(
    "rejects a malformed RIFF/chunk case with %s",
    (value, code, wrap?: true) => {
      const result = parse(wrap ? webp([value]) : value);

      expect(result.complete).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code }),
      );
    },
  );

  it("enforces maxChunks before parsing another chunk", () => {
    const result = parse(webp([chunk("VP8 "), chunk("EXIF")]), 1);

    expect(result.complete).toBe(false);
    expect(result.chunks).toHaveLength(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "WEBP_CHUNK_LIMIT_EXCEEDED" }),
    );
  });

  it("keeps structural failure state when its diagnostic is capped", () => {
    const input = webp([chunk("VP8X")], Uint8Array.of(1));
    const result = parseWebP(new ByteReader(input), 100, 1);

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "WEBP_TRAILING_DATA" }),
    ]);
  });
});
