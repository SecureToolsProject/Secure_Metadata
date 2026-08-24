import { describe, expect, it } from "vitest";

import { inspectMetadata } from "../../src/index.js";

const MALFORMED_INPUTS = [
  Uint8Array.of(),
  Uint8Array.of(0x00),
  Uint8Array.of(0xff),
  Uint8Array.of(0xff, 0xd8),
  Uint8Array.of(0x01, 0x02, 0x03),
  new Uint8Array(16),
  new Uint8Array(16).fill(0xff),
  Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0x00),
  Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57),
  Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a),
  Uint8Array.of(0x89, 0x50, 0x00, 0x47),
] as const;

describe("deterministic malformed inputs", () => {
  it.each(MALFORMED_INPUTS)("is ordinary inspection input: %j", (input) => {
    expect(() => inspectMetadata(input)).not.toThrow();
    expect(inspectMetadata(input)).toEqual(inspectMetadata(input));
  });
});
