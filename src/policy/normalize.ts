import type { CleaningPolicy } from "../core/types.js";

export interface NormalizedCleaningPolicy {
  readonly removeExif: boolean;
  readonly removeXmp: boolean;
  readonly removeIptc: boolean;
  readonly removeComments: boolean;
  readonly removeTextMetadata: boolean;
  readonly removeTimestamps: boolean;
  readonly preserveIcc: boolean;
}

export const DEFAULT_CLEANING_POLICY: Readonly<NormalizedCleaningPolicy> =
  Object.freeze({
    removeExif: true,
    removeXmp: true,
    removeIptc: true,
    removeComments: true,
    removeTextMetadata: true,
    removeTimestamps: true,
    preserveIcc: true,
  });

export function normalizeCleaningPolicy(
  policy?: CleaningPolicy,
): Readonly<NormalizedCleaningPolicy> {
  return Object.freeze({
    removeExif: policy?.removeExif ?? DEFAULT_CLEANING_POLICY.removeExif,
    removeXmp: policy?.removeXmp ?? DEFAULT_CLEANING_POLICY.removeXmp,
    removeIptc: policy?.removeIptc ?? DEFAULT_CLEANING_POLICY.removeIptc,
    removeComments:
      policy?.removeComments ?? DEFAULT_CLEANING_POLICY.removeComments,
    removeTextMetadata:
      policy?.removeTextMetadata ?? DEFAULT_CLEANING_POLICY.removeTextMetadata,
    removeTimestamps:
      policy?.removeTimestamps ?? DEFAULT_CLEANING_POLICY.removeTimestamps,
    preserveIcc:
      policy?.preserveIcc ??
      policy?.preserveColorProfiles ??
      DEFAULT_CLEANING_POLICY.preserveIcc,
  });
}
