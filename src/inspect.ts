import { NotImplementedError } from "./core/errors.js";
import type {
  BinaryInput,
  InspectOptions,
  MetadataReport,
} from "./core/types.js";

export function inspectMetadata(
  input: BinaryInput,
  options?: InspectOptions,
): MetadataReport {
  void input;
  void options;
  throw new NotImplementedError("inspectMetadata");
}
