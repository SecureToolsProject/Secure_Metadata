import { describe, expect, it } from "vitest";

import {
  cleanMetadata,
  inspectMetadata,
  NotImplementedError,
  verifyMetadata,
  type BinaryInput,
  type MetadataEntry,
} from "../../src/index.js";

describe("public API", () => {
  it("exports the three top-level operations", () => {
    expect(inspectMetadata).toBeTypeOf("function");
    expect(cleanMetadata).toBeTypeOf("function");
    expect(verifyMetadata).toBeTypeOf("function");
  });

  it.each([
    ["inspectMetadata", inspectMetadata],
    ["cleanMetadata", cleanMetadata],
    ["verifyMetadata", verifyMetadata],
  ] as const)(
    "returns deterministic unimplemented behavior from %s",
    (_, operation) => {
      expect(() => operation(new Uint8Array())).toThrowError(
        NotImplementedError,
      );
      expect(() => operation(new Uint8Array())).toThrowError(
        expect.objectContaining({ code: "NOT_IMPLEMENTED" }),
      );
    },
  );

  it("accepts Uint8Array and ArrayBuffer as public binary input types", () => {
    const inputs: readonly BinaryInput[] = [
      new Uint8Array(),
      new ArrayBuffer(0),
    ];

    for (const input of inputs) {
      expect(() => inspectMetadata(input)).toThrowError(NotImplementedError);
    }
  });

  it("models category and privacy relevance as independent axes", () => {
    const entry: MetadataEntry = {
      id: "example",
      namespace: "exif",
      name: "Example",
      category: "location",
      privacy: "non-sensitive",
      source: { format: "jpeg", container: "jpeg-segment" },
    };

    expect(entry.category).toBe("location");
    expect(entry.privacy).toBe("non-sensitive");
  });
});
