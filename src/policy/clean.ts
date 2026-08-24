import { NotImplementedError } from "../core/errors.js";
import type {
  BinaryInput,
  CleaningPolicy,
  CleanResult,
} from "../core/types.js";

export function cleanMetadata(
  input: BinaryInput,
  policy?: CleaningPolicy,
): CleanResult {
  void input;
  void policy;
  throw new NotImplementedError("cleanMetadata");
}
