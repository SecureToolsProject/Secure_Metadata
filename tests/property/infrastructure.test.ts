import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { propertyParameters } from "./config.js";

describe("reproducible property infrastructure", () => {
  it("runs a bounded seeded property with shrinkable values", () => {
    let runs = 0;

    fc.assert(
      fc.property(fc.integer(), (value) => {
        runs += 1;
        expect(Number.isSafeInteger(value)).toBe(true);
      }),
      propertyParameters({ seed: 9, numRuns: 16 }),
    );

    expect(runs).toBe(16);
  });
});
