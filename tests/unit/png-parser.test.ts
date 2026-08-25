import { describe, expect, it } from "vitest";

import { ByteReader } from "../../src/core/binary/index.js";
import { pngCrc32 } from "../../src/png/crc32.js";
import { parsePng } from "../../src/png/parser.js";
import {
  ascii,
  chunk,
  concat,
  itxtChunk,
  png,
  PNG_SIGNATURE,
  textChunk,
  u32be,
  ztxtChunk,
} from "../helpers/png-builder.js";

const parse = (input: Uint8Array, maxChunks = 64, maxStringBytes = 1_024) =>
  parsePng(new ByteReader(input), maxChunks, maxStringBytes);

describe("PNG bounded container parser", () => {
  it("classifies image, metadata, rendering, APNG, and unknown chunks", () => {
    const input = png([
      chunk("IHDR", new Uint8Array(13)),
      chunk("PLTE"),
      chunk("IDAT", Uint8Array.of(1, 2)),
      textChunk("Author"),
      ztxtChunk("Comment"),
      itxtChunk("Description"),
      itxtChunk("XML:com.adobe.xmp", "packet", true),
      chunk("eXIf"),
      chunk("iCCP"),
      chunk("tIME"),
      chunk("gAMA"),
      chunk("cHRM"),
      chunk("sRGB"),
      chunk("sBIT"),
      chunk("pHYs"),
      chunk("acTL"),
      chunk("fcTL"),
      chunk("fdAT"),
      chunk("vpAg"),
      chunk("ABCD"),
      chunk("IEND"),
    ]);

    const result = parse(input);

    expect(result.complete).toBe(true);
    expect(result.chunks.map(({ fourCC, kind }) => [fourCC, kind])).toEqual([
      ["IHDR", "critical"],
      ["PLTE", "critical"],
      ["IDAT", "image"],
      ["tEXt", "metadata"],
      ["zTXt", "metadata"],
      ["iTXt", "metadata"],
      ["iTXt", "metadata"],
      ["eXIf", "metadata"],
      ["iCCP", "metadata"],
      ["tIME", "metadata"],
      ["gAMA", "color"],
      ["cHRM", "color"],
      ["sRGB", "color"],
      ["sBIT", "color"],
      ["pHYs", "color"],
      ["acTL", "animation"],
      ["fcTL", "animation"],
      ["fdAT", "animation"],
      ["vpAg", "unknown"],
      ["ABCD", "critical"],
      ["IEND", "critical"],
    ]);
    expect(
      result.chunks.slice(3, 10).map(({ metadataKind }) => metadataKind),
    ).toEqual(["text", "text", "text", "xmp", "exif", "icc", "timestamp"]);
    expect(result.chunks[4]).toMatchObject({
      keyword: "Comment",
      textCompressed: true,
      ancillary: true,
    });
    expect(result.chunks[6]).toMatchObject({
      keyword: "XML:com.adobe.xmp",
      textCompressed: true,
    });
    expect(result.chunks[19]?.ancillary).toBe(false);
  });

  it("validates CRCs without making a bounded file structurally incomplete", () => {
    expect(pngCrc32(ascii("123456789"))).toBe(0xcbf43926);
    const result = parse(
      png([chunk("IDAT", Uint8Array.of(1), 0), chunk("IEND")]),
    );

    expect(result.complete).toBe(true);
    expect(result.chunks[0]?.crcValid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "PNG_INVALID_CRC", severity: "warning" }),
    );
  });

  it("stops at IEND and records but does not parse trailing data", () => {
    const trailing = concat(u32be(0), ascii("tEXt"), u32be(0));
    const result = parse(png([chunk("IEND")], trailing));

    expect(result.chunks).toHaveLength(1);
    expect(result.containerLength).toBe(PNG_SIGNATURE.byteLength + 12);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "PNG_TRAILING_DATA" }),
    );
  });

  it("bounds keyword scans and recognizes XMP only by the exact keyword", () => {
    const result = parse(
      png([
        textChunk("LongKeyword"),
        itxtChunk("XML:com.adobe.xmpx"),
        chunk("IEND"),
      ]),
      64,
      4,
    );

    expect(result.complete).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "PNG_TEXT_LIMIT_EXCEEDED" }),
    );
    expect(result.chunks[1]?.metadataKind).toBe("text");
  });

  it.each([
    ["signature", Uint8Array.of(1, 2), "PNG_INVALID_SIGNATURE"],
    [
      "length",
      concat(PNG_SIGNATURE, Uint8Array.of(0)),
      "PNG_TRUNCATED_CHUNK_LENGTH",
    ],
    [
      "type",
      concat(PNG_SIGNATURE, u32be(0), Uint8Array.of(0x49)),
      "PNG_TRUNCATED_CHUNK_TYPE",
    ],
    [
      "invalid type",
      concat(PNG_SIGNATURE, u32be(0), ascii("I3ND"), u32be(0)),
      "PNG_INVALID_CHUNK_TYPE",
    ],
    [
      "data",
      concat(PNG_SIGNATURE, u32be(5), ascii("IDAT"), Uint8Array.of(1, 2)),
      "PNG_TRUNCATED_CHUNK_DATA",
    ],
    [
      "CRC",
      concat(PNG_SIGNATURE, u32be(0), ascii("IDAT"), Uint8Array.of(1, 2)),
      "PNG_MISSING_CRC",
    ],
    [
      "IEND payload",
      png([chunk("IEND", Uint8Array.of(1))]),
      "PNG_INVALID_IEND",
    ],
    ["IEND absence", png([chunk("IDAT")]), "PNG_MISSING_IEND"],
  ] as const)("rejects malformed PNG %s", (_name, input, code) => {
    const result = parse(input);

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code }),
    );
  });

  it("enforces the chunk-count limit before reading another chunk", () => {
    const result = parse(png([chunk("IDAT"), chunk("IEND")]), 1);

    expect(result.complete).toBe(false);
    expect(result.chunks).toHaveLength(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "PNG_CHUNK_LIMIT_EXCEEDED" }),
    );
  });
});
