import type {
  ImageFormat,
  ParseLimits,
  SecureMetadataErrorCode,
} from "../../src/index.js";
import {
  concat as jpegConcat,
  EXIF,
  jpeg,
  marker,
  MARKER,
  segment,
} from "../helpers/jpeg-builder.js";
import {
  chunk as pngChunk,
  concat as pngConcat,
  png,
  PNG_SIGNATURE,
  u32be,
} from "../helpers/png-builder.js";
import {
  chunk as webpChunk,
  concat as webpConcat,
  fourCC,
  u32le,
  vp8x,
  webp,
  withRiffSize,
} from "../helpers/webp-builder.js";

export type CorpusCategory = "generic" | "jpeg" | "webp" | "png";

export interface MalformedCase {
  readonly name: string;
  readonly category: CorpusCategory;
  readonly input: Uint8Array;
  readonly expectedFormat: ImageFormat;
  readonly expectedStatus?:
    | "format-only"
    | "container-partial"
    | "container-inspected"
    | "metadata-partial";
  readonly expectedDiagnostic?: string;
  readonly cleanError?: SecureMetadataErrorCode;
  readonly cleanable?: true;
  readonly limits?: Partial<ParseLimits>;
}

function alternating(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) =>
    index % 2 === 0 ? 0xaa : 0x55,
  );
}

function jpegDeclaredSegment(
  code: number,
  declaredLength: number,
  payload: Uint8Array = new Uint8Array(),
): Uint8Array {
  return jpegConcat(
    marker(code),
    Uint8Array.of(declaredLength >>> 8, declaredLength & 0xff),
    payload,
  );
}

function rawWebPBody(bodyAfterFormType: Uint8Array): Uint8Array {
  const body = webpConcat(fourCC("WEBP"), bodyAfterFormType);
  return webpConcat(fourCC("RIFF"), u32le(body.byteLength), body);
}

const GENERIC_CASES: readonly MalformedCase[] = [
  ["generic-empty", Uint8Array.of()],
  ["generic-single-zero", Uint8Array.of(0)],
  ["generic-single-ff", Uint8Array.of(0xff)],
  ["generic-zeroes", new Uint8Array(16)],
  ["generic-ff-fill", new Uint8Array(16).fill(0xff)],
  ["generic-alternating-bytes", alternating(16)],
  ["generic-jpeg-prefix", Uint8Array.of(0xff)],
  ["generic-png-signature-prefix", PNG_SIGNATURE.slice(0, 7)],
  [
    "generic-riff-webp-prefix",
    webpConcat(fourCC("RIFF"), u32le(4), Uint8Array.of(0x57, 0x45, 0x42)),
  ],
].map(([name, input]) => ({
  name: name as string,
  category: "generic" as const,
  input: input as Uint8Array,
  expectedFormat: "unknown" as const,
  cleanError: "UNSUPPORTED_FORMAT" as const,
}));

const JPEG_CASES: readonly MalformedCase[] = [
  {
    name: "jpeg-soi-only",
    input: marker(MARKER.SOI),
    expectedDiagnostic: "JPEG_MISSING_EOI",
  },
  {
    name: "jpeg-truncated-marker",
    input: jpegConcat(marker(MARKER.SOI), Uint8Array.of(0xff)),
    expectedDiagnostic: "JPEG_TRUNCATED_MARKER",
  },
  {
    name: "jpeg-fill-bytes-ending-at-eof",
    input: jpegConcat(marker(MARKER.SOI), Uint8Array.of(0xff, 0xff, 0xff)),
    expectedDiagnostic: "JPEG_TRUNCATED_MARKER",
  },
  {
    name: "jpeg-truncated-app1-length",
    input: jpegConcat(marker(MARKER.SOI), marker(MARKER.APP1)),
    expectedDiagnostic: "JPEG_TRUNCATED_SEGMENT_LENGTH",
  },
  {
    name: "jpeg-invalid-segment-length-one",
    input: jpegConcat(marker(MARKER.SOI), jpegDeclaredSegment(MARKER.APP1, 1)),
    expectedDiagnostic: "JPEG_INVALID_SEGMENT_LENGTH",
  },
  {
    name: "jpeg-declared-segment-past-eof",
    input: jpegConcat(
      marker(MARKER.SOI),
      jpegDeclaredSegment(MARKER.APP1, 8, Uint8Array.of(0x45)),
    ),
    expectedDiagnostic: "JPEG_TRUNCATED_SEGMENT",
  },
  {
    name: "jpeg-truncated-sos-header",
    input: jpegConcat(marker(MARKER.SOI), marker(MARKER.SOS), Uint8Array.of(0)),
    expectedDiagnostic: "JPEG_TRUNCATED_SEGMENT_LENGTH",
  },
  {
    name: "jpeg-scan-ending-with-ff",
    input: jpegConcat(
      marker(MARKER.SOI),
      segment(MARKER.SOS),
      Uint8Array.of(1, 0xff),
    ),
    expectedDiagnostic: "JPEG_TRUNCATED_SCAN",
  },
  {
    name: "jpeg-stuffed-ff00-near-eof",
    input: jpegConcat(
      marker(MARKER.SOI),
      segment(MARKER.SOS),
      Uint8Array.of(1, 0xff, 0, 2),
    ),
    expectedDiagnostic: "JPEG_TRUNCATED_SCAN",
  },
  {
    name: "jpeg-restart-marker-near-eof",
    input: jpegConcat(
      marker(MARKER.SOI),
      segment(MARKER.SOS),
      Uint8Array.of(1, 0xff, 0xd0),
    ),
    expectedDiagnostic: "JPEG_TRUNCATED_SCAN",
  },
  {
    name: "jpeg-missing-eoi",
    input: jpegConcat(marker(MARKER.SOI), segment(MARKER.APP1, EXIF)),
    expectedDiagnostic: "JPEG_MISSING_EOI",
  },
  {
    name: "jpeg-second-scan-truncated",
    input: jpegConcat(
      marker(MARKER.SOI),
      segment(MARKER.SOS),
      Uint8Array.of(1),
      segment(MARKER.SOS),
      Uint8Array.of(2, 0xff),
    ),
    expectedDiagnostic: "JPEG_TRUNCATED_SCAN",
  },
  {
    name: "jpeg-segment-limit-exceeded",
    input: jpeg(segment(MARKER.APP0), segment(MARKER.APP1)),
    expectedDiagnostic: "JPEG_SEGMENT_LIMIT_EXCEEDED",
    limits: { maxSegments: 2 },
  },
  {
    name: "jpeg-bounded-malformed-exif",
    input: jpeg(segment(MARKER.APP1, jpegConcat(EXIF, Uint8Array.of(0x49)))),
    expectedStatus: "metadata-partial",
    expectedDiagnostic: "TIFF_TRUNCATED_HEADER",
    cleanable: true,
  },
].map(
  (item) =>
    ({
      category: "jpeg" as const,
      expectedFormat: "jpeg" as const,
      expectedStatus: "container-partial" as const,
      cleanError: "INCOMPLETE_JPEG" as const,
      ...item,
    }) as MalformedCase,
);

const WEBP_CASES: readonly MalformedCase[] = [
  {
    name: "webp-riff-prefix-only",
    input: fourCC("RIFF"),
    expectedFormat: "unknown",
    expectedStatus: "format-only",
    cleanError: "UNSUPPORTED_FORMAT",
  },
  {
    name: "webp-riff-webp-header-truncated",
    input: webpConcat(
      fourCC("RIFF"),
      u32le(4),
      Uint8Array.of(0x57, 0x45, 0x42),
    ),
    expectedFormat: "unknown",
    expectedStatus: "format-only",
    cleanError: "UNSUPPORTED_FORMAT",
  },
  {
    name: "webp-riff-size-below-minimum",
    input: withRiffSize(webp([]), 3),
    expectedDiagnostic: "WEBP_INVALID_RIFF_SIZE",
  },
  {
    name: "webp-declared-riff-past-eof",
    input: withRiffSize(webp([]), 100),
    expectedDiagnostic: "WEBP_TRUNCATED_RIFF",
  },
  {
    name: "webp-partial-chunk-fourcc",
    input: rawWebPBody(Uint8Array.of(0x45, 0x58)),
    expectedDiagnostic: "WEBP_TRUNCATED_CHUNK_HEADER",
  },
  {
    name: "webp-partial-chunk-length",
    input: rawWebPBody(webpConcat(fourCC("EXIF"), Uint8Array.of(1, 0))),
    expectedDiagnostic: "WEBP_TRUNCATED_CHUNK_HEADER",
  },
  {
    name: "webp-chunk-payload-past-riff",
    input: rawWebPBody(webpConcat(fourCC("EXIF"), u32le(5), Uint8Array.of(1))),
    expectedDiagnostic: "WEBP_TRUNCATED_CHUNK",
  },
  {
    name: "webp-odd-chunk-missing-pad",
    input: rawWebPBody(webpConcat(fourCC("XMP "), u32le(1), Uint8Array.of(1))),
    expectedDiagnostic: "WEBP_INVALID_PADDING",
  },
  {
    name: "webp-duplicate-vp8x",
    input: webp([vp8x(0), vp8x(0)]),
    expectedDiagnostic: "WEBP_DUPLICATE_VP8X",
  },
  {
    name: "webp-invalid-vp8x-length",
    input: webp([webpChunk("VP8X", Uint8Array.of(1))]),
    expectedDiagnostic: "WEBP_INVALID_VP8X",
  },
  {
    name: "webp-inconsistent-vp8x-flags",
    input: webp([vp8x(0x08)]),
    expectedStatus: "container-inspected",
    expectedDiagnostic: "WEBP_INCONSISTENT_FEATURE_FLAGS",
    cleanable: true,
  },
  {
    name: "webp-chunk-limit-exceeded",
    input: webp([webpChunk("VP8 "), webpChunk("ANIM")]),
    expectedDiagnostic: "WEBP_CHUNK_LIMIT_EXCEEDED",
    limits: { maxChunks: 1 },
  },
  {
    name: "webp-bounded-malformed-exif",
    input: webp([webpChunk("EXIF", Uint8Array.of(0x49))]),
    expectedStatus: "container-inspected",
    cleanable: true,
  },
].map(
  (item) =>
    ({
      category: "webp" as const,
      expectedFormat: "webp" as const,
      expectedStatus: "container-partial" as const,
      cleanError: "INCOMPLETE_WEBP" as const,
      ...item,
    }) as MalformedCase,
);

const PNG_CASES: readonly MalformedCase[] = [
  {
    name: "png-signature-only",
    input: PNG_SIGNATURE,
    expectedDiagnostic: "PNG_MISSING_IEND",
  },
  {
    name: "png-partial-chunk-length",
    input: pngConcat(PNG_SIGNATURE, Uint8Array.of(0, 0)),
    expectedDiagnostic: "PNG_TRUNCATED_CHUNK_LENGTH",
  },
  {
    name: "png-partial-chunk-fourcc",
    input: pngConcat(PNG_SIGNATURE, u32be(0), Uint8Array.of(0x49, 0x45)),
    expectedDiagnostic: "PNG_TRUNCATED_CHUNK_TYPE",
  },
  {
    name: "png-chunk-data-truncated",
    input: pngConcat(
      PNG_SIGNATURE,
      u32be(5),
      Uint8Array.of(0x49, 0x44, 0x41, 0x54, 1),
    ),
    expectedDiagnostic: "PNG_TRUNCATED_CHUNK_DATA",
  },
  {
    name: "png-chunk-crc-truncated",
    input: pngConcat(
      PNG_SIGNATURE,
      u32be(0),
      Uint8Array.of(0x49, 0x44, 0x41, 0x54, 0),
    ),
    expectedDiagnostic: "PNG_MISSING_CRC",
  },
  {
    name: "png-invalid-retained-crc",
    input: png([pngChunk("IDAT", Uint8Array.of(1), 0), pngChunk("IEND")]),
    expectedStatus: "container-inspected",
    expectedDiagnostic: "PNG_INVALID_CRC",
    cleanable: true,
  },
  {
    name: "png-missing-iend",
    input: png([pngChunk("IDAT")]),
    expectedDiagnostic: "PNG_MISSING_IEND",
  },
  {
    name: "png-data-after-iend",
    input: png([pngChunk("IEND")], Uint8Array.of(1, 2, 3)),
    expectedStatus: "container-inspected",
    expectedDiagnostic: "PNG_TRAILING_DATA",
    cleanable: true,
  },
  {
    name: "png-very-large-declared-length",
    input: pngConcat(
      PNG_SIGNATURE,
      u32be(0xffff_ffff),
      Uint8Array.of(0x49, 0x44, 0x41, 0x54),
    ),
    expectedDiagnostic: "PNG_TRUNCATED_CHUNK_DATA",
  },
  {
    name: "png-chunk-limit-exceeded",
    input: png([pngChunk("IDAT"), pngChunk("IEND")]),
    expectedDiagnostic: "PNG_CHUNK_LIMIT_EXCEEDED",
    limits: { maxChunks: 1 },
  },
  {
    name: "png-malformed-text-structure",
    input: png([pngChunk("tEXt", Uint8Array.of(0)), pngChunk("IEND")]),
    expectedStatus: "container-inspected",
    expectedDiagnostic: "PNG_INVALID_TEXT",
    cleanable: true,
  },
  {
    name: "png-malformed-ztxt-prefix",
    input: png([pngChunk("zTXt", Uint8Array.of(0x4b, 0)), pngChunk("IEND")]),
    expectedStatus: "container-inspected",
    expectedDiagnostic: "PNG_INVALID_TEXT",
    cleanable: true,
  },
  {
    name: "png-malformed-itxt-prefix",
    input: png([
      pngChunk("iTXt", Uint8Array.of(0x4b, 0, 2, 0)),
      pngChunk("IEND"),
    ]),
    expectedStatus: "container-inspected",
    expectedDiagnostic: "PNG_INVALID_TEXT",
    cleanable: true,
  },
  {
    name: "png-bounded-malformed-exif",
    input: png([pngChunk("eXIf", Uint8Array.of(0x49)), pngChunk("IEND")]),
    expectedStatus: "metadata-partial",
    expectedDiagnostic: "TIFF_TRUNCATED_HEADER",
    cleanable: true,
  },
].map(
  (item) =>
    ({
      category: "png" as const,
      expectedFormat: "png" as const,
      expectedStatus: "container-partial" as const,
      cleanError: "INCOMPLETE_PNG" as const,
      ...item,
    }) as MalformedCase,
);

export const MALFORMED_CORPUS: readonly MalformedCase[] = [
  ...GENERIC_CASES,
  ...JPEG_CASES,
  ...WEBP_CASES,
  ...PNG_CASES,
];

export const CORPUS_COUNTS = Object.freeze({
  generic: GENERIC_CASES.length,
  jpeg: JPEG_CASES.length,
  webp: WEBP_CASES.length,
  png: PNG_CASES.length,
});
