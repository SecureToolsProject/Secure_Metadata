import { describe, expect, it } from "vitest";

import { ByteReader } from "../../src/core/binary/byte-reader.js";
import { BinaryBoundsError } from "../../src/core/errors.js";

describe("ByteReader valid reads", () => {
  const bytes = Uint8Array.from([0x01, 0x02, 0x03, 0x80, 0xff]);
  const reader = new ByteReader(bytes);

  it("reads the first and last byte", () => {
    expect(reader.u8(0)).toBe(0x01);
    expect(reader.u8(reader.length - 1)).toBe(0xff);
  });

  it("reads 16-bit values in both endian orders", () => {
    expect(reader.u16LE(0)).toBe(0x0201);
    expect(reader.u16BE(0)).toBe(0x0102);
  });

  it("reads 32-bit values in both endian orders", () => {
    expect(reader.u32LE(0)).toBe(0x80030201);
    expect(reader.u32BE(0)).toBe(0x01020380);
  });

  it("returns the full unsigned 32-bit range", () => {
    const unsigned = new ByteReader(Uint8Array.of(0xff, 0xff, 0xff, 0xff));

    expect(unsigned.u32LE(0)).toBe(4_294_967_295);
    expect(unsigned.u32BE(0)).toBe(4_294_967_295);
  });

  it("accepts zero-length and exact-to-EOF ranges", () => {
    expect(reader.has(reader.length, 0)).toBe(true);
    expect(reader.slice(reader.length, 0)).toHaveLength(0);
    expect(reader.slice(1, reader.length - 1)).toEqual(bytes.subarray(1));
  });

  it("returns a bounded subarray view", () => {
    const result = reader.slice(1, 2);

    expect(result).toEqual(Uint8Array.of(0x02, 0x03));
    expect(result.buffer).toBe(bytes.buffer);
    expect(result.byteOffset).toBe(bytes.byteOffset + 1);
  });

  it("matches signatures without allocating slices", () => {
    expect(reader.matches(1, [0x02, 0x03, 0x80])).toBe(true);
    expect(reader.matches(1, [0x02, 0x04])).toBe(false);
    expect(reader.matches(4, [0xff, 0x00])).toBe(false);
  });
});

describe("ByteReader invalid reads", () => {
  const reader = new ByteReader(Uint8Array.of(0x01, 0x02, 0x03, 0x04));

  it.each([
    ["one byte past EOF", () => reader.u8(4), "OUT_OF_BOUNDS"],
    ["multi-byte read crossing EOF", () => reader.u16BE(3), "OUT_OF_BOUNDS"],
    ["negative offset", () => reader.u8(-1), "INVALID_OFFSET"],
    ["fractional offset", () => reader.u8(0.5), "INVALID_OFFSET"],
    ["NaN offset", () => reader.u8(Number.NaN), "INVALID_OFFSET"],
    [
      "infinite offset",
      () => reader.u8(Number.POSITIVE_INFINITY),
      "INVALID_OFFSET",
    ],
    [
      "unsafe offset",
      () => reader.u8(Number.MAX_SAFE_INTEGER + 1),
      "INVALID_OFFSET",
    ],
    ["negative length", () => reader.slice(0, -1), "INVALID_LENGTH"],
    ["fractional length", () => reader.slice(0, 1.5), "INVALID_LENGTH"],
    [
      "unsafe length",
      () => reader.slice(0, Number.MAX_SAFE_INTEGER + 1),
      "INVALID_LENGTH",
    ],
    [
      "huge in-range integer length",
      () => reader.slice(0, Number.MAX_SAFE_INTEGER),
      "OUT_OF_BOUNDS",
    ],
  ] as const)("rejects %s predictably", (_, operation, code) => {
    expect(operation).toThrowError(BinaryBoundsError);
    expect(operation).toThrowError(expect.objectContaining({ code }));
  });

  it("reports invalid ranges as absent", () => {
    expect(reader.has(-1)).toBe(false);
    expect(reader.has(0, -1)).toBe(false);
    expect(reader.has(0.5)).toBe(false);
    expect(reader.has(Number.NaN)).toBe(false);
    expect(reader.has(Number.POSITIVE_INFINITY)).toBe(false);
    expect(reader.has(4, 1)).toBe(false);
    expect(reader.matches(-1, [0x01])).toBe(false);
  });

  it("does not leak native DataView RangeError", () => {
    try {
      reader.u32BE(1);
      expect.unreachable("the range should have failed");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BinaryBoundsError);
      expect(error).not.toBeInstanceOf(RangeError);
    }
  });
});
