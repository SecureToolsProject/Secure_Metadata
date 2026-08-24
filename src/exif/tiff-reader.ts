import { ByteReader } from "../core/binary/index.js";

export type TiffByteOrder = "little" | "big";

export class TiffReader {
  readonly length: number;
  readonly #reader: ByteReader;
  readonly #littleEndian: boolean;

  constructor(bytes: Uint8Array, byteOrder: TiffByteOrder) {
    this.#reader = new ByteReader(bytes);
    this.#littleEndian = byteOrder === "little";
    this.length = bytes.byteLength;
  }

  has(offset: number, length = 1): boolean {
    return this.#reader.has(offset, length);
  }

  u8(offset: number): number {
    return this.#reader.u8(offset);
  }

  u16(offset: number): number {
    return this.#littleEndian
      ? this.#reader.u16LE(offset)
      : this.#reader.u16BE(offset);
  }

  u32(offset: number): number {
    return this.#littleEndian
      ? this.#reader.u32LE(offset)
      : this.#reader.u32BE(offset);
  }

  i32(offset: number): number {
    const value = this.u32(offset);
    return value >= 0x8000_0000 ? value - 0x1_0000_0000 : value;
  }
}
