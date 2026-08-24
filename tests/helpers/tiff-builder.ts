import { TIFF_FIELD_TYPE } from "../../src/exif/field-types.js";

export type TestByteOrder = "little" | "big";

export interface TestIfdEntry {
  readonly tag: number;
  readonly type: number;
  readonly count: number;
  readonly value?: number | readonly number[];
  readonly valueOffset?: number;
}

export class TiffBuilder {
  readonly #bytes: Uint8Array;
  readonly #view: DataView;
  readonly #little: boolean;
  #used = 8;

  constructor(
    readonly order: TestByteOrder = "little",
    size = 1_024,
    firstIfdOffset = 8,
  ) {
    this.#bytes = new Uint8Array(size);
    this.#view = new DataView(this.#bytes.buffer);
    this.#little = order === "little";
    this.#bytes.set(this.#little ? [0x49, 0x49] : [0x4d, 0x4d], 0);
    this.u16(2, 42);
    this.u32(4, firstIfdOffset);
  }

  u16(offset: number, value: number): this {
    this.#view.setUint16(offset, value, this.#little);
    this.#used = Math.max(this.#used, offset + 2);
    return this;
  }

  u32(offset: number, value: number): this {
    this.#view.setUint32(offset, value, this.#little);
    this.#used = Math.max(this.#used, offset + 4);
    return this;
  }

  i32(offset: number, value: number): this {
    this.#view.setInt32(offset, value, this.#little);
    this.#used = Math.max(this.#used, offset + 4);
    return this;
  }

  bytes(offset: number, values: ArrayLike<number>): this {
    this.#bytes.set(Array.from(values), offset);
    this.#used = Math.max(this.#used, offset + values.length);
    return this;
  }

  ascii(offset: number, value: string, nul = true): this {
    const bytes = Array.from(value, (character) => character.charCodeAt(0));
    if (nul) {
      bytes.push(0);
    }
    return this.bytes(offset, bytes);
  }

  rational(
    offset: number,
    values: readonly (readonly [number, number])[],
    signed = false,
  ): this {
    for (let index = 0; index < values.length; index += 1) {
      const pair = values[index];
      if (pair === undefined) {
        continue;
      }
      const pairOffset = offset + index * 8;
      if (signed) {
        this.i32(pairOffset, pair[0]);
        this.i32(pairOffset + 4, pair[1]);
      } else {
        this.u32(pairOffset, pair[0]);
        this.u32(pairOffset + 4, pair[1]);
      }
    }
    return this;
  }

  ifd(
    offset: number,
    entries: readonly TestIfdEntry[],
    nextIfdOffset = 0,
  ): this {
    this.u16(offset, entries.length);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry === undefined) {
        continue;
      }
      const entryOffset = offset + 2 + index * 12;
      this.u16(entryOffset, entry.tag);
      this.u16(entryOffset + 2, entry.type);
      this.u32(entryOffset + 4, entry.count);
      if (entry.valueOffset !== undefined) {
        this.u32(entryOffset + 8, entry.valueOffset);
      } else {
        this.#inline(entryOffset + 8, entry);
      }
    }
    this.u32(offset + 2 + entries.length * 12, nextIfdOffset);
    return this;
  }

  finish(length = this.#used): Uint8Array {
    return this.#bytes.slice(0, length);
  }

  #writeInline(offset: number, type: number, values: readonly number[]): void {
    if (type === TIFF_FIELD_TYPE.SHORT) {
      for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (value !== undefined) {
          this.u16(offset + index * 2, value);
        }
      }
      return;
    }
    if (type === TIFF_FIELD_TYPE.LONG || type === TIFF_FIELD_TYPE.SLONG) {
      const value = values[0] ?? 0;
      if (type === TIFF_FIELD_TYPE.SLONG) {
        this.i32(offset, value);
      } else {
        this.u32(offset, value);
      }
      return;
    }
    this.bytes(offset, values);
  }

  #inlineEntry(entry: TestIfdEntry): readonly number[] {
    return typeof entry.value === "number"
      ? [entry.value]
      : (entry.value ?? []);
  }

  #inline(offset: number, entry: TestIfdEntry): void {
    this.#writeInline(offset, entry.type, this.#inlineEntry(entry));
  }
}
