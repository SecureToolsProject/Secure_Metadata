import { describe, expect, it } from "vitest";

import {
  cleanMetadata,
  DEFAULT_CLEANING_POLICY,
  DEFAULT_JPEG_CLEANING_POLICY,
  DEFAULT_PNG_CLEANING_POLICY,
  DEFAULT_WEBP_CLEANING_POLICY,
  IncompletePngError,
  inspectMetadata,
  verifyMetadata,
  type CleaningPolicy,
  type VerificationPolicy,
} from "../../src/index.js";
import { ICC, jpeg, MARKER, segment, XMP } from "../helpers/jpeg-builder.js";
import {
  chunk as pngChunk,
  png,
  PNG_SIGNATURE,
  textChunk,
} from "../helpers/png-builder.js";
import { chunk as webpChunk, webp } from "../helpers/webp-builder.js";

const ICC_FIXTURES = [
  ["jpeg", jpeg(segment(MARKER.APP2, ICC))],
  ["webp", webp([webpChunk("ICCP")])],
  ["png", png([pngChunk("iCCP"), pngChunk("IEND")])],
] as const;

describe("cross-format policy normalization", () => {
  it("uses one immutable authoritative default policy", () => {
    expect(DEFAULT_CLEANING_POLICY).toEqual({
      removeExif: true,
      removeXmp: true,
      removeIptc: true,
      removeComments: true,
      removeTextMetadata: true,
      removeTimestamps: true,
      preserveIcc: true,
    });
    expect(Object.isFrozen(DEFAULT_CLEANING_POLICY)).toBe(true);
    expect(DEFAULT_JPEG_CLEANING_POLICY).toBe(DEFAULT_CLEANING_POLICY);
    expect(DEFAULT_WEBP_CLEANING_POLICY).toBe(DEFAULT_CLEANING_POLICY);
    expect(DEFAULT_PNG_CLEANING_POLICY).toBe(DEFAULT_CLEANING_POLICY);
  });

  it("applies deprecated ICC alias precedence identically once across all formats", () => {
    const cases: readonly [CleaningPolicy, boolean][] = [
      [{ preserveColorProfiles: false }, false],
      [{ preserveIcc: true, preserveColorProfiles: false }, true],
      [{ preserveIcc: false, preserveColorProfiles: true }, false],
    ];

    for (const [, input] of ICC_FIXTURES) {
      for (const [policy, expectedPresent] of cases) {
        const result = cleanMetadata(input, policy);
        expect(
          result.report.entries.some(({ namespace }) => namespace === "icc"),
        ).toBe(expectedPresent);
      }
    }
  });
});

describe("cross-format reporting and verification", () => {
  it.each(ICC_FIXTURES)("classifies %s ICC consistently", (_format, input) => {
    expect(inspectMetadata(input).entries).toContainEqual(
      expect.objectContaining({
        namespace: "icc",
        category: "color",
        privacy: "non-sensitive",
      }),
    );
  });

  it.each([
    ["jpeg", jpeg(), { textMetadata: "present", timestamps: "present" }],
    [
      "webp",
      webp([]),
      {
        iptc: "present",
        comments: "present",
        textMetadata: "present",
        timestamps: "present",
      },
    ],
    ["png", png([pngChunk("IEND")]), { iptc: "present", comments: "present" }],
  ] as const)(
    "omits not-applicable %s expectations instead of claiming a search",
    (_format, input, unsupported) => {
      const result = verifyMetadata(input, {
        ...unsupported,
        requireNoPrivacyRelevantMetadata: false,
      } as VerificationPolicy);

      expect(result.valid).toBe(true);
      expect(result.checks).toEqual([]);
    },
  );

  it.each([
    ["jpeg", jpeg(segment(MARKER.APP1, XMP), segment(MARKER.APP2, ICC))],
    ["webp", webp([webpChunk("XMP "), webpChunk("ICCP")])],
    ["png", png([textChunk("Author"), pngChunk("tIME"), pngChunk("IEND")])],
  ] as const)("bounds normalized %s metadata entries", (_format, input) => {
    const report = inspectMetadata(input, {
      limits: { maxMetadataEntries: 1 },
    });

    expect(report.entries).toHaveLength(1);
    expect(report.metadataTruncated).toBe(true);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: "METADATA_ENTRY_LIMIT_EXCEEDED" }),
    );
  });

  it("caps accumulated diagnostics for reports and typed cleaner errors", () => {
    const warnings = png([
      pngChunk("IDAT", Uint8Array.of(1), 0),
      pngChunk("IDAT", Uint8Array.of(2), 0),
      pngChunk("IEND"),
    ]);
    expect(
      inspectMetadata(warnings, { limits: { maxDiagnostics: 1 } }).diagnostics,
    ).toHaveLength(1);

    try {
      cleanMetadata(PNG_SIGNATURE, { limits: { maxDiagnostics: 0 } });
      expect.fail("Expected incomplete PNG cleaning to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(IncompletePngError);
      expect((error as IncompletePngError).diagnostics).toEqual([]);
    }
  });

  it("fails verification closed when metadata reporting is truncated", () => {
    const input = webp([webpChunk("EXIF"), webpChunk("XMP ")]);
    const result = verifyMetadata(input, {
      exif: "ignore",
      xmp: "absent",
      requireNoPrivacyRelevantMetadata: false,
      limits: { maxMetadataEntries: 1, maxDiagnostics: 0 },
    });

    expect(result.valid).toBe(false);
    expect(result.checks).toEqual([]);
    expect(result.report.metadataTruncated).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });
});
