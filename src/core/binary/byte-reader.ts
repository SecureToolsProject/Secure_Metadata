import { assertValidRange, hasValidRange } from "./bounds.js";

/** Read-only access to a caller-supplied byte view through checked ranges. */
export class ByteReader {
  readonly length: number;

  readonly #bytes: Uint8Array;
  readonly #view: DataView;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.length = bytes.byteLength;
  }

  has(offset: number, length = 1): boolean {
    return hasValidRange(this.length, offset, length);
  }

  u8(offset: number): number {
    assertValidRange(this.length, offset, 1);
    return this.#view.getUint8(offset);
  }

  u16LE(offset: number): number {
    assertValidRange(this.length, offset, 2);
    return this.#view.getUint16(offset, true);
  }

  u16BE(offset: number): number {
    assertValidRange(this.length, offset, 2);
    return this.#view.getUint16(offset, false);
  }

  u32LE(offset: number): number {
    assertValidRange(this.length, offset, 4);
    return this.#view.getUint32(offset, true);
  }

  u32BE(offset: number): number {
    assertValidRange(this.length, offset, 4);
    return this.#view.getUint32(offset, false);
  }

  /** Returns a bounded view, not a copy, after validating the complete range. */
  slice(offset: number, length: number): Uint8Array {
    assertValidRange(this.length, offset, length);
    return this.#bytes.subarray(offset, offset + length);
  }

  matches(offset: number, signature: readonly number[]): boolean {
    if (!this.has(offset, signature.length)) {
      return false;
    }

    for (let index = 0; index < signature.length; index += 1) {
      if (this.#bytes[offset + index] !== signature[index]) {
        return false;
      }
    }

    return true;
  }
}
