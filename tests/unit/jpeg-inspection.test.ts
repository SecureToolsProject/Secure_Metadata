import { describe, expect, it } from "vitest";

import { inspectMetadata } from "../../src/index.js";
import {
  ADOBE,
  concat,
  EXIF,
  EXTENDED_XMP,
  ICC,
  JFIF,
  jpeg,
  marker,
  MARKER,
  PHOTOSHOP,
  segment,
  XMP,
} from "../helpers/jpeg-builder.js";

describe("JPEG metadata-container inspection", () => {
  it("returns a complete container report for minimal JPEG", () => {
    expect(inspectMetadata(jpeg())).toEqual({
      format: "jpeg",
      size: 4,
      inspectionStatus: "container-inspected",
      entries: [],
      diagnostics: [],
    });
  });

  it("creates an EXIF container entry without decoding TIFF", () => {
    const input = jpeg(
      segment(MARKER.APP1, concat(EXIF, Uint8Array.of(0x49, 0x49, 0x2a, 0))),
    );
    const report = inspectMetadata(input);

    expect(report.entries).toEqual([
      expect.objectContaining({
        namespace: "exif",
        name: "EXIF container",
        category: "unknown",
        privacy: "potentially-sensitive",
        source: expect.objectContaining({
          format: "jpeg",
          container: "jpeg-segment",
          offset: 2,
          jpegMarker: MARKER.APP1,
        }),
      }),
    ]);
    expect(report.entries[0]).not.toHaveProperty("value");
  });

  it.each([
    [XMP, "XMP container"],
    [EXTENDED_XMP, "Extended XMP container"],
  ] as const)(
    "classifies standard and extended XMP signatures",
    (payload, name) => {
      expect(
        inspectMetadata(jpeg(segment(MARKER.APP1, payload))).entries,
      ).toEqual([expect.objectContaining({ namespace: "xmp", name })]);
    },
  );

  it("does not infer EXIF or XMP from unknown APP1", () => {
    expect(
      inspectMetadata(jpeg(segment(MARKER.APP1, Uint8Array.of(1, 2, 3))))
        .entries,
    ).toEqual([]);
  });

  it("classifies ICC as non-sensitive color metadata", () => {
    expect(inspectMetadata(jpeg(segment(MARKER.APP2, ICC))).entries).toEqual([
      expect.objectContaining({
        namespace: "icc",
        category: "color",
        privacy: "non-sensitive",
      }),
    ]);
  });

  it("classifies signed Photoshop APP13 as potentially-sensitive IPTC", () => {
    expect(
      inspectMetadata(jpeg(segment(MARKER.APP13, PHOTOSHOP))).entries,
    ).toEqual([
      expect.objectContaining({
        namespace: "iptc",
        privacy: "potentially-sensitive",
      }),
    ]);
  });

  it("does not infer IPTC from unknown APP13", () => {
    expect(
      inspectMetadata(jpeg(segment(MARKER.APP13, Uint8Array.of(1, 2, 3))))
        .entries,
    ).toEqual([]);
  });

  it.each([new Uint8Array(), Uint8Array.of(0xff, 0x00, 0x80)])(
    "records COM presence without text decoding",
    (payload) => {
      const entries = inspectMetadata(
        jpeg(segment(MARKER.COM, payload)),
      ).entries;

      expect(entries).toEqual([
        expect.objectContaining({
          namespace: "jpeg-comment",
          category: "description",
          privacy: "potentially-sensitive",
        }),
      ]);
      expect(entries[0]).not.toHaveProperty("value");
    },
  );

  it("detects JFIF and Adobe internally without adding privacy entries", () => {
    const report = inspectMetadata(
      jpeg(segment(MARKER.APP0, JFIF), segment(MARKER.APP14, ADOBE)),
    );

    expect(report.entries).toEqual([]);
    expect(report.inspectionStatus).toBe("container-inspected");
  });
});

describe("JPEG inspection safety and status", () => {
  it("returns partial status and diagnostics for missing EOI", () => {
    const input = concat(marker(MARKER.SOI), segment(MARKER.APP1, EXIF));
    const report = inspectMetadata(input);

    expect(report).toMatchObject({
      format: "jpeg",
      inspectionStatus: "container-partial",
    });
    expect(report.entries).toHaveLength(1);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_MISSING_EOI" }),
    );
  });

  it("enforces a custom JPEG segment limit", () => {
    const report = inspectMetadata(
      jpeg(segment(MARKER.APP0), segment(MARKER.APP1), segment(MARKER.APP2)),
      { limits: { maxSegments: 2 } },
    );

    expect(report.inspectionStatus).toBe("container-partial");
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: "JPEG_SEGMENT_LIMIT_EXCEEDED" }),
    );
  });

  it("calculates offsets relative to an exact Uint8Array subview", () => {
    const embedded = jpeg(segment(MARKER.APP1, EXIF));
    const backing = concat(
      Uint8Array.of(0xaa, 0xbb),
      embedded,
      Uint8Array.of(0xff, 0xd8),
    );
    const view = new Uint8Array(
      backing.buffer,
      backing.byteOffset + 2,
      embedded.byteLength,
    );
    const report = inspectMetadata(view);

    expect(report).toMatchObject({
      size: embedded.byteLength,
      inspectionStatus: "metadata-partial",
      diagnostics: [expect.objectContaining({ code: "TIFF_TRUNCATED_HEADER" })],
    });
    expect(report.entries[0]?.source.offset).toBe(2);
  });

  it.each([
    jpeg(),
    jpeg(segment(MARKER.APP1, EXIF)),
    jpeg(segment(MARKER.SOS), Uint8Array.of(1, 0xff, 0x00, 2)),
  ])("is deterministic and preserves input", (input) => {
    const before = Uint8Array.from(input);

    expect(inspectMetadata(input)).toEqual(inspectMetadata(input));
    expect(input).toEqual(before);
  });
});
