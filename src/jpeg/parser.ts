import { type ByteReader } from "../core/binary/index.js";
import type { Diagnostic, DiagnosticCode } from "../core/diagnostics.js";
import { classifyApplicationSegment, classifySegmentKind } from "./classify.js";
import {
  isApplicationMarker,
  isRestartMarker,
  isStandaloneMarker,
  isValidMarkerCode,
  JPEG_MARKER,
  markerName,
} from "./markers.js";
import type { JpegParseResult, JpegSegment } from "./types.js";

interface MarkerPosition {
  readonly marker: number;
  readonly markerOffset: number;
  readonly rangeOffset: number;
  readonly afterMarker: number;
}

interface ParserState {
  readonly segments: JpegSegment[];
  readonly diagnostics: Diagnostic[];
}

function diagnostic(
  severity: Diagnostic["severity"],
  code: DiagnosticCode,
  message: string,
  offset?: number,
): Diagnostic {
  return offset === undefined
    ? { severity, code, message }
    : { severity, code, message, offset };
}

function readMarker(
  reader: ByteReader,
  offset: number,
): MarkerPosition | Diagnostic {
  if (reader.u8(offset) !== 0xff) {
    return diagnostic(
      "error",
      "JPEG_INVALID_MARKER",
      "Expected a JPEG marker prefix.",
      offset,
    );
  }

  let cursor = offset;
  while (reader.has(cursor) && reader.u8(cursor) === 0xff) {
    cursor += 1;
  }

  if (!reader.has(cursor)) {
    return diagnostic(
      "error",
      "JPEG_TRUNCATED_MARKER",
      "JPEG input ends within marker fill bytes.",
      offset,
    );
  }

  const marker = reader.u8(cursor);
  if (marker === 0x00 || !isValidMarkerCode(marker)) {
    return diagnostic(
      "error",
      "JPEG_INVALID_MARKER",
      `Invalid JPEG marker code 0x${marker.toString(16).padStart(2, "0")}.`,
      cursor,
    );
  }

  return {
    marker,
    markerOffset: cursor - 1,
    rangeOffset: offset,
    afterMarker: cursor + 1,
  };
}

function addSegment(
  state: ParserState,
  segment: JpegSegment,
  maxSegments: number,
): boolean {
  if (state.segments.length >= maxSegments) {
    state.diagnostics.push(
      diagnostic(
        "error",
        "JPEG_SEGMENT_LIMIT_EXCEEDED",
        `JPEG marker count exceeds maxSegments ${String(maxSegments)}.`,
        segment.offset,
      ),
    );
    return false;
  }

  state.segments.push(segment);
  return true;
}

function incompleteResult(
  state: ParserState,
  sawSoi: boolean,
): JpegParseResult {
  return {
    segments: state.segments,
    complete: false,
    sawSoi,
    sawEoi: false,
    diagnostics: state.diagnostics,
  };
}

function skipScanData(
  reader: ByteReader,
  scanOffset: number,
  state: ParserState,
  maxSegments: number,
): number | undefined {
  let cursor = scanOffset;

  while (reader.has(cursor)) {
    if (reader.u8(cursor) !== 0xff) {
      cursor += 1;
      continue;
    }

    const fillStart = cursor;
    cursor += 1;
    while (reader.has(cursor) && reader.u8(cursor) === 0xff) {
      cursor += 1;
    }

    if (!reader.has(cursor)) {
      state.diagnostics.push(
        diagnostic(
          "error",
          "JPEG_TRUNCATED_SCAN",
          "JPEG entropy-coded scan ends within marker fill bytes.",
          fillStart,
        ),
      );
      return undefined;
    }

    const marker = reader.u8(cursor);
    if (marker === 0x00) {
      cursor += 1;
      continue;
    }

    if (isRestartMarker(marker)) {
      const markerOffset = cursor - 1;
      if (
        !addSegment(
          state,
          {
            marker,
            markerName: markerName(marker),
            offset: markerOffset,
            length: 2,
            rangeOffset: fillStart,
            rangeLength: cursor + 1 - fillStart,
            kind: "standalone",
          },
          maxSegments,
        )
      ) {
        return undefined;
      }
      cursor += 1;
      continue;
    }

    return cursor - 1;
  }

  state.diagnostics.push(
    diagnostic(
      "error",
      "JPEG_TRUNCATED_SCAN",
      "JPEG entropy-coded scan reaches EOF before a terminating marker.",
      scanOffset,
    ),
  );
  return undefined;
}

export function parseJpeg(
  reader: ByteReader,
  maxSegments: number,
): JpegParseResult {
  const state: ParserState = { segments: [], diagnostics: [] };

  if (!reader.matches(0, [0xff, JPEG_MARKER.SOI])) {
    state.diagnostics.push(
      diagnostic(
        "error",
        "JPEG_INVALID_SOI",
        "JPEG input does not begin with the SOI marker.",
        0,
      ),
    );
    return incompleteResult(state, false);
  }

  if (
    !addSegment(
      state,
      {
        marker: JPEG_MARKER.SOI,
        markerName: "SOI",
        offset: 0,
        length: 2,
        rangeOffset: 0,
        rangeLength: 2,
        kind: "standalone",
      },
      maxSegments,
    )
  ) {
    return incompleteResult(state, true);
  }

  let offset = 2;
  while (reader.has(offset)) {
    const markerResult = readMarker(reader, offset);
    if ("severity" in markerResult) {
      state.diagnostics.push(markerResult);
      return incompleteResult(state, true);
    }

    const { marker, markerOffset, rangeOffset, afterMarker } = markerResult;
    if (marker === JPEG_MARKER.SOI) {
      state.diagnostics.push(
        diagnostic(
          "error",
          "JPEG_INVALID_MARKER",
          "Unexpected SOI marker inside JPEG container.",
          markerOffset,
        ),
      );
      return incompleteResult(state, true);
    }

    if (isStandaloneMarker(marker)) {
      if (
        !addSegment(
          state,
          {
            marker,
            markerName: markerName(marker),
            offset: markerOffset,
            length: 2,
            rangeOffset,
            rangeLength: afterMarker - rangeOffset,
            kind: "standalone",
          },
          maxSegments,
        )
      ) {
        return incompleteResult(state, true);
      }

      offset = afterMarker;
      if (marker === JPEG_MARKER.EOI) {
        if (offset < reader.length) {
          state.diagnostics.push(
            diagnostic(
              "warning",
              "JPEG_TRAILING_DATA",
              `JPEG contains ${String(reader.length - offset)} trailing byte(s) after EOI.`,
              offset,
            ),
          );
        }
        return {
          segments: state.segments,
          complete: true,
          sawSoi: true,
          sawEoi: true,
          diagnostics: state.diagnostics,
        };
      }
      continue;
    }

    if (!reader.has(afterMarker, 2)) {
      state.diagnostics.push(
        diagnostic(
          "error",
          "JPEG_TRUNCATED_SEGMENT_LENGTH",
          `${markerName(marker)} is missing its two-byte segment length.`,
          afterMarker,
        ),
      );
      return incompleteResult(state, true);
    }

    const declaredLength = reader.u16BE(afterMarker);
    if (declaredLength < 2) {
      state.diagnostics.push(
        diagnostic(
          "error",
          "JPEG_INVALID_SEGMENT_LENGTH",
          `${markerName(marker)} declares invalid length ${String(declaredLength)}.`,
          afterMarker,
        ),
      );
      return incompleteResult(state, true);
    }

    if (!reader.has(afterMarker, declaredLength)) {
      state.diagnostics.push(
        diagnostic(
          "error",
          "JPEG_TRUNCATED_SEGMENT",
          `${markerName(marker)} extends beyond the JPEG input.`,
          markerOffset,
        ),
      );
      return incompleteResult(state, true);
    }

    const payloadOffset = afterMarker + 2;
    const payloadLength = declaredLength - 2;
    const segmentEnd = afterMarker + declaredLength;
    const classification = isApplicationMarker(marker)
      ? classifyApplicationSegment(reader, marker, payloadOffset, payloadLength)
      : undefined;
    const segment: JpegSegment = {
      marker,
      markerName: markerName(marker),
      offset: markerOffset,
      length: declaredLength + 2,
      rangeOffset,
      rangeLength: segmentEnd - rangeOffset,
      payloadOffset,
      payloadLength,
      kind: classifySegmentKind(marker),
      ...(classification ?? {}),
    };

    if (!addSegment(state, segment, maxSegments)) {
      return incompleteResult(state, true);
    }

    offset = segmentEnd;
    if (marker === JPEG_MARKER.SOS) {
      const nextMarkerOffset = skipScanData(
        reader,
        segmentEnd,
        state,
        maxSegments,
      );
      if (nextMarkerOffset === undefined) {
        return incompleteResult(state, true);
      }
      offset = nextMarkerOffset;
    }
  }

  state.diagnostics.push(
    diagnostic(
      "error",
      "JPEG_MISSING_EOI",
      "JPEG input ends before an EOI marker.",
      reader.length,
    ),
  );
  return incompleteResult(state, true);
}
