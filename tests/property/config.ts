import type { Parameters } from "fast-check";

export const PROPERTY_SEED = 0x5ec0_0009;
export const PROPERTY_RUNS = 64;
export const CLEANER_PROPERTY_RUNS = 48;
export const MAX_PROPERTY_BYTES = 1_024;

function environmentInteger(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer; received ${raw}.`);
  }
  return value;
}

export function propertyParameters(
  defaults: {
    readonly seed?: number;
    readonly numRuns?: number;
  } = {},
): Parameters<unknown> {
  const path = process.env.PROPERTY_PATH;
  return {
    seed: environmentInteger("PROPERTY_SEED") ?? defaults.seed ?? PROPERTY_SEED,
    numRuns:
      environmentInteger("PROPERTY_RUNS") ?? defaults.numRuns ?? PROPERTY_RUNS,
    ...(path === undefined || path.length === 0 ? {} : { path }),
  };
}
