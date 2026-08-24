import { IncompleteJpegError, UnsupportedFormatError } from "../core/errors.js";
import type {
  BinaryInput,
  VerificationCheck,
  VerificationExpectation,
  VerificationPolicy,
  VerificationResult,
} from "../core/types.js";
import { inspectMetadata } from "../inspect.js";

export const DEFAULT_JPEG_VERIFICATION_POLICY = Object.freeze({
  exif: "absent",
  xmp: "absent",
  iptc: "absent",
  comments: "absent",
  icc: "ignore",
} satisfies Record<string, VerificationExpectation>);

export function verifyMetadata(
  input: BinaryInput,
  expectation?: VerificationPolicy,
): VerificationResult {
  const report = inspectMetadata(
    input,
    expectation?.limits === undefined
      ? undefined
      : { limits: expectation.limits },
  );
  if (report.format !== "jpeg") {
    throw new UnsupportedFormatError("verifyMetadata", report.format);
  }
  if (report.inspectionStatus === "container-partial") {
    throw new IncompleteJpegError("verifyMetadata", report.diagnostics);
  }

  const privacyDefault =
    expectation?.requireNoPrivacyRelevantMetadata === false
      ? "ignore"
      : "absent";
  const expected = {
    exif: expectation?.exif ?? privacyDefault,
    xmp: expectation?.xmp ?? privacyDefault,
    iptc: expectation?.iptc ?? privacyDefault,
    "jpeg-comment": expectation?.comments ?? privacyDefault,
    icc: expectation?.icc ?? "ignore",
  } satisfies Record<
    "exif" | "xmp" | "iptc" | "jpeg-comment" | "icc",
    VerificationExpectation
  >;

  const checks: VerificationCheck[] = [];
  for (const [namespace, wanted] of Object.entries(expected) as Array<
    [VerificationCheck["namespace"], VerificationExpectation]
  >) {
    if (wanted === "ignore") {
      continue;
    }

    const present = report.entries.some(
      (entry) => entry.namespace === namespace,
    );
    const actual = present ? "present" : "absent";
    checks.push({
      namespace,
      expected: wanted,
      actual,
      passed: actual === wanted,
    });
  }

  return {
    valid: checks.every(({ passed }) => passed),
    checks,
    report,
    diagnostics: report.diagnostics,
  };
}
