import { describe, expect, it } from "vitest";

import { inspectMetadata } from "../../src/index.js";

const PNG_SIGNATURE = Uint8Array.of(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
);

function webpHeader(size = [0, 0, 0, 0]): Uint8Array {
  return Uint8Array.of(0x52, 0x49, 0x46, 0x46, ...size, 0x57, 0x45, 0x42, 0x50);
}

describe("JPEG format detection", () => {
  it.each([
    [Uint8Array.of(0xff, 0xd8), "exact signature"],
    [Uint8Array.of(0xff, 0xd8, 0xff, 0xe0), "normal prefix"],
    [Uint8Array.of(0xff, 0xd8, 0x00, 0xff), "malformed trailing data"],
  ])("detects JPEG from the required start signature: %s", (input) => {
    expect(inspectMetadata(input).format).toBe("jpeg");
  });

  it.each([
    Uint8Array.of(0xff),
    Uint8Array.of(0xd8, 0xff),
    Uint8Array.of(0x00, 0x01),
  ])("does not misclassify non-matching bytes", (input) => {
    expect(inspectMetadata(input).format).toBe("unknown");
  });
});

describe("PNG format detection", () => {
  it("detects the exact eight-byte signature", () => {
    expect(inspectMetadata(PNG_SIGNATURE).format).toBe("png");
  });

  it("detects the signature with trailing bytes", () => {
    const input = Uint8Array.from([...PNG_SIGNATURE, 0x00, 0x01]);

    expect(inspectMetadata(input).format).toBe("png");
  });

  it("treats every truncated signature as unknown", () => {
    for (let length = 0; length < PNG_SIGNATURE.length; length += 1) {
      expect(inspectMetadata(PNG_SIGNATURE.slice(0, length)).format).toBe(
        "unknown",
      );
    }
  });

  it("rejects a one-byte signature corruption", () => {
    const corrupted = Uint8Array.from(PNG_SIGNATURE);
    corrupted[4] = 0xff;

    expect(inspectMetadata(corrupted).format).toBe("unknown");
  });

  it("respects a Uint8Array view into a larger backing buffer", () => {
    const backing = Uint8Array.of(0xaa, 0xbb, ...PNG_SIGNATURE, 0xcc);
    const view = new Uint8Array(
      backing.buffer,
      backing.byteOffset + 2,
      PNG_SIGNATURE.length,
    );

    expect(inspectMetadata(view)).toMatchObject({ format: "png", size: 8 });
  });
});

describe("WebP format detection", () => {
  it("detects the minimal RIFF....WEBP header", () => {
    expect(inspectMetadata(webpHeader()).format).toBe("webp");
  });

  it("accepts arbitrary RIFF size bytes and trailing data", () => {
    const input = Uint8Array.from([
      ...webpHeader([0xff, 0x00, 0x80, 0x7f]),
      0x01,
      0x02,
    ]);

    expect(inspectMetadata(input).format).toBe("webp");
  });

  it.each([
    Uint8Array.from([0x52, 0x49, 0x46, 0x46]),
    Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
    Uint8Array.from(webpHeader().slice(0, 11)),
    Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45,
    ]),
  ])("treats incomplete or unrelated RIFF input as unknown", (input) => {
    expect(inspectMetadata(input).format).toBe("unknown");
  });
});
