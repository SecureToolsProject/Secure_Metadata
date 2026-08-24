import type { BinaryInput } from "../types.js";

/** Normalizes supported input without copying or widening a Uint8Array view. */
export function toUint8Array(input: BinaryInput): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}
