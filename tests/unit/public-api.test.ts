import { describe, expect, it } from "vitest";

import {
  cleanMetadata,
  inspectMetadata,
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

  it("accepts Uint8Array and ArrayBuffer as public inspection inputs", () => {
    const inputs: readonly BinaryInput[] = [
      new Uint8Array(),
      new ArrayBuffer(0),
    ];

    for (const input of inputs) {
      expect(inspectMetadata(input)).toMatchObject({
        format: "unknown",
        inspectionStatus: "format-only",
      });
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
