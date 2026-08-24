import { describe, expect, it } from "vitest";

import { toUint8Array } from "../../src/core/binary/input.js";

describe("binary input normalization", () => {
  it("creates a no-copy view over an ArrayBuffer", () => {
    const buffer = Uint8Array.of(1, 2, 3).buffer;
    const normalized = toUint8Array(buffer);

    expect(normalized.buffer).toBe(buffer);
    expect(normalized).toEqual(Uint8Array.of(1, 2, 3));
  });

  it("preserves the exact range of a Uint8Array view", () => {
    const backing = Uint8Array.of(0xaa, 1, 2, 3, 0xbb);
    const view = new Uint8Array(backing.buffer, backing.byteOffset + 1, 3);
    const normalized = toUint8Array(view);

    expect(normalized).toBe(view);
    expect(normalized.byteOffset).toBe(view.byteOffset);
    expect(normalized.byteLength).toBe(3);
    expect(normalized).toEqual(Uint8Array.of(1, 2, 3));
  });
});
