import { type ByteReader } from "../core/binary/index.js";
import type { Diagnostic, DiagnosticCode } from "../core/diagnostics.js";
import { pngCrc32 } from "./crc32.js";
import type {
  PngChunk,
  PngChunkKind,
  PngMetadataKind,
  PngParseResult,
} from "./types.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const XMP_KEYWORD = "XML:com.adobe.xmp";

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

function failure(
  diagnostics: readonly Diagnostic[],
  chunks: readonly PngChunk[] = [],
  containerLength = 0,
): PngParseResult {
  return {
    chunks,
    complete: false,
    sawIend: false,
    containerLength,
    diagnostics,
  };
}

function fourCC(reader: ByteReader, offset: number): string {
  return String.fromCharCode(
    reader.u8(offset),
    reader.u8(offset + 1),
    reader.u8(offset + 2),
    reader.u8(offset + 3),
  );
}

function isAsciiLetter(value: number): boolean {
  return (value >= 0x41 && value <= 0x5a) || (value >= 0x61 && value <= 0x7a);
}

function classifyChunk(
  fourCC: string,
  ancillary: boolean,
): {
  readonly kind: PngChunkKind;
  readonly metadataKind?: PngMetadataKind;
} {
  switch (fourCC) {
    case "IDAT":
      return { kind: "image" };
    case "IHDR":
    case "PLTE":
    case "IEND":
      return { kind: "critical" };
    case "eXIf":
      return { kind: "metadata", metadataKind: "exif" };
    case "iCCP":
      return { kind: "metadata", metadataKind: "icc" };
    case "tIME":
      return { kind: "metadata", metadataKind: "timestamp" };
    case "tEXt":
    case "zTXt":
    case "iTXt":
      return { kind: "metadata", metadataKind: "text" };
    case "gAMA":
    case "cHRM":
    case "sRGB":
    case "sBIT":
    case "pHYs":
      return { kind: "color" };
    case "acTL":
    case "fcTL":
    case "fdAT":
      return { kind: "animation" };
    default:
      return { kind: ancillary ? "unknown" : "critical" };
  }
}

function readKeyword(
  reader: ByteReader,
  dataOffset: number,
  dataLength: number,
  maxStringBytes: number,
  diagnostics: Diagnostic[],
  fourCC: string,
): { readonly value: string; readonly afterKeyword: number } | undefined {
  const keywordLimit = Math.min(maxStringBytes, 79);
  const scanLength = Math.min(dataLength, keywordLimit + 1);
  for (let index = 0; index < scanLength; index += 1) {
    if (reader.u8(dataOffset + index) !== 0) {
      continue;
    }
    if (index === 0) {
      diagnostics.push(
        diagnostic(
          "warning",
          "PNG_INVALID_TEXT",
          `${fourCC} has an empty text keyword.`,
          dataOffset,
        ),
      );
      return undefined;
    }
    const characters: number[] = [];
    for (let keywordIndex = 0; keywordIndex < index; keywordIndex += 1) {
      characters.push(reader.u8(dataOffset + keywordIndex));
    }
    return {
      value: String.fromCharCode(...characters),
      afterKeyword: dataOffset + index + 1,
    };
  }

  diagnostics.push(
    dataLength > keywordLimit && keywordLimit === maxStringBytes
      ? diagnostic(
          "warning",
          "PNG_TEXT_LIMIT_EXCEEDED",
          `${fourCC} keyword exceeds maxStringBytes ${String(maxStringBytes)}.`,
          dataOffset,
        )
      : diagnostic(
          "warning",
          "PNG_INVALID_TEXT",
          `${fourCC} text keyword is not NUL-terminated.`,
          dataOffset,
        ),
  );
  return undefined;
}

export function parsePng(
  reader: ByteReader,
  maxChunks: number,
  maxStringBytes: number,
): PngParseResult {
  const diagnostics: Diagnostic[] = [];
  const chunks: PngChunk[] = [];
  if (!reader.matches(0, PNG_SIGNATURE)) {
    return failure([
      diagnostic(
        "error",
        "PNG_INVALID_SIGNATURE",
        "PNG input does not contain the complete eight-byte signature.",
        0,
      ),
    ]);
  }

  let offset = 8;
  while (offset < reader.length) {
    if (chunks.length >= maxChunks) {
      diagnostics.push(
        diagnostic(
          "error",
          "PNG_CHUNK_LIMIT_EXCEEDED",
          `PNG chunk count exceeds maxChunks ${String(maxChunks)}.`,
          offset,
        ),
      );
      return failure(diagnostics, chunks, offset);
    }
    const remaining = reader.length - offset;
    if (remaining < 4) {
      diagnostics.push(
        diagnostic(
          "error",
          "PNG_TRUNCATED_CHUNK_LENGTH",
          "PNG input ends within a chunk length field.",
          offset,
        ),
      );
      return failure(diagnostics, chunks, offset);
    }
    if (remaining < 8) {
      diagnostics.push(
        diagnostic(
          "error",
          "PNG_TRUNCATED_CHUNK_TYPE",
          "PNG input ends within a chunk type field.",
          offset + 4,
        ),
      );
      return failure(diagnostics, chunks, offset);
    }

    const dataLength = reader.u32BE(offset);
    const typeOffset = offset + 4;
    for (let index = 0; index < 4; index += 1) {
      if (!isAsciiLetter(reader.u8(typeOffset + index))) {
        diagnostics.push(
          diagnostic(
            "error",
            "PNG_INVALID_CHUNK_TYPE",
            "PNG chunk types must contain four ASCII letters.",
            typeOffset,
          ),
        );
        return failure(diagnostics, chunks, offset);
      }
    }

    const type = fourCC(reader, typeOffset);
    const dataOffset = offset + 8;
    const available = reader.length - dataOffset;
    if (dataLength > available) {
      diagnostics.push(
        diagnostic(
          "error",
          "PNG_TRUNCATED_CHUNK_DATA",
          `${type} data extends beyond the supplied input.`,
          offset,
        ),
      );
      return failure(diagnostics, chunks, offset);
    }
    if (available - dataLength < 4) {
      diagnostics.push(
        diagnostic(
          "error",
          "PNG_MISSING_CRC",
          `${type} is missing its complete CRC field.`,
          dataOffset + dataLength,
        ),
      );
      return failure(diagnostics, chunks, offset);
    }

    const crcOffset = dataOffset + dataLength;
    const totalLength = 12 + dataLength;
    if (!Number.isSafeInteger(totalLength) || totalLength > remaining) {
      diagnostics.push(
        diagnostic(
          "error",
          "PNG_TRUNCATED_CHUNK_DATA",
          `${type} physical chunk range is invalid.`,
          offset,
        ),
      );
      return failure(diagnostics, chunks, offset);
    }

    const ancillary = (reader.u8(typeOffset) & 0x20) !== 0;
    const classification = classifyChunk(type, ancillary);
    let keyword: string | undefined;
    let textCompressed: boolean | undefined;
    if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      const parsedKeyword = readKeyword(
        reader,
        dataOffset,
        dataLength,
        maxStringBytes,
        diagnostics,
        type,
      );
      keyword = parsedKeyword?.value;
      if (type === "zTXt") {
        textCompressed = true;
        if (
          parsedKeyword !== undefined &&
          parsedKeyword.afterKeyword >= dataOffset + dataLength
        ) {
          diagnostics.push(
            diagnostic(
              "warning",
              "PNG_INVALID_TEXT",
              "zTXt is missing its compression method byte.",
              parsedKeyword.afterKeyword,
            ),
          );
        }
      } else if (type === "iTXt" && parsedKeyword !== undefined) {
        if (dataOffset + dataLength - parsedKeyword.afterKeyword < 2) {
          diagnostics.push(
            diagnostic(
              "warning",
              "PNG_INVALID_TEXT",
              "iTXt is missing compression flag or method bytes.",
              parsedKeyword.afterKeyword,
            ),
          );
        } else {
          const flag = reader.u8(parsedKeyword.afterKeyword);
          textCompressed = flag === 1;
          if (flag > 1) {
            diagnostics.push(
              diagnostic(
                "warning",
                "PNG_INVALID_TEXT",
                "iTXt compression flag must be zero or one.",
                parsedKeyword.afterKeyword,
              ),
            );
          }
        }
      }
    }

    const expectedCrc = reader.u32BE(crcOffset);
    const actualCrc = pngCrc32(reader.slice(typeOffset, 4 + dataLength));
    const crcValid = expectedCrc === actualCrc;
    if (!crcValid) {
      diagnostics.push(
        diagnostic(
          "warning",
          "PNG_INVALID_CRC",
          `${type} CRC does not match its type and data.`,
          crcOffset,
        ),
      );
    }

    const chunk: PngChunk = {
      fourCC: type,
      offset,
      dataOffset,
      dataLength,
      totalLength,
      ancillary,
      ...classification,
      ...(type === "iTXt" && keyword === XMP_KEYWORD
        ? { metadataKind: "xmp" as const }
        : {}),
      ...(keyword === undefined ? {} : { keyword }),
      ...(textCompressed === undefined ? {} : { textCompressed }),
      crcValid,
    };
    chunks.push(chunk);
    offset += totalLength;

    if (type === "IEND") {
      if (dataLength !== 0) {
        diagnostics.push(
          diagnostic(
            "error",
            "PNG_INVALID_IEND",
            "IEND must have an empty data field.",
            chunk.dataOffset,
          ),
        );
        return failure(diagnostics, chunks, offset);
      }
      if (offset < reader.length) {
        diagnostics.push(
          diagnostic(
            "warning",
            "PNG_TRAILING_DATA",
            `PNG contains ${String(reader.length - offset)} trailing byte(s) after IEND.`,
            offset,
          ),
        );
      }
      return {
        chunks,
        complete: true,
        sawIend: true,
        containerLength: offset,
        diagnostics,
      };
    }
  }

  diagnostics.push(
    diagnostic(
      "error",
      "PNG_MISSING_IEND",
      "PNG input ends before an IEND chunk.",
      reader.length,
    ),
  );
  return failure(diagnostics, chunks, reader.length);
}
