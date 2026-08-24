import { describe, expect, it } from "vitest";

import { DEFAULT_PARSE_LIMITS } from "../../src/index.js";

describe("default parse limits", () => {
  it("provides positive finite safe integers", () => {
    for (const limit of Object.values(DEFAULT_PARSE_LIMITS)) {
      expect(Number.isSafeInteger(limit)).toBe(true);
      expect(limit).toBeGreaterThan(0);
    }
  });

  it("cannot be mutated", () => {
    expect(Object.isFrozen(DEFAULT_PARSE_LIMITS)).toBe(true);
  });
});
