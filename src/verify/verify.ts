import { NotImplementedError } from "../core/errors.js";
import type {
  BinaryInput,
  VerificationPolicy,
  VerificationResult,
} from "../core/types.js";

export function verifyMetadata(
  input: BinaryInput,
  expectation?: VerificationPolicy,
): VerificationResult {
  void input;
  void expectation;
  throw new NotImplementedError("verifyMetadata");
}
