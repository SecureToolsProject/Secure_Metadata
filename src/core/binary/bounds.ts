import { BinaryBoundsError } from "../errors.js";

export function hasValidRange(
  inputLength: number,
  offset: number,
  length: number,
): boolean {
  return (
    Number.isSafeInteger(offset) &&
    Number.isSafeInteger(length) &&
    offset >= 0 &&
    length >= 0 &&
    offset <= inputLength &&
    length <= inputLength - offset
  );
}

export function assertValidRange(
  inputLength: number,
  offset: number,
  length: number,
): void {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new BinaryBoundsError("INVALID_OFFSET", inputLength, offset, length);
  }

  if (!Number.isSafeInteger(length) || length < 0) {
    throw new BinaryBoundsError("INVALID_LENGTH", inputLength, offset, length);
  }

  if (offset > inputLength || length > inputLength - offset) {
    throw new BinaryBoundsError("OUT_OF_BOUNDS", inputLength, offset, length);
  }
}
