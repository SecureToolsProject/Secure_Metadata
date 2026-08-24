import type { Diagnostic } from "../core/diagnostics.js";
import type { MetadataValue, RationalValue } from "../core/types.js";
import { TIFF_FIELD_TYPE } from "./field-types.js";
import type { TiffReader } from "./tiff-reader.js";
import type { TiffTagDefinition } from "./tags.js";

const MAX_DECODED_COMPONENTS = 1_024;

export interface DecodedTiffValue {
  readonly value?: MetadataValue;
  readonly diagnostics: readonly Diagnostic[];
}

function scalarOrArray<T>(values: readonly T[]): T | readonly T[] {
  if (values.length === 1) {
    const value = values[0];
    if (value !== undefined) {
      return value;
    }
  }
  return values;
}

function ascii(reader: TiffReader, offset: number, count: number): string {
  let result = "";
  for (let index = 0; index < count; index += 1) {
    const byte = reader.u8(offset + index);
    if (byte === 0) {
      break;
    }
    result += byte <= 0x7f ? String.fromCharCode(byte) : "?";
  }
  return result;
}

function unsignedValues(
  reader: TiffReader,
  offset: number,
  count: number,
  width: 1 | 2 | 4,
): number | readonly number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const componentOffset = offset + index * width;
    values.push(
      width === 1
        ? reader.u8(componentOffset)
        : width === 2
          ? reader.u16(componentOffset)
          : reader.u32(componentOffset),
    );
  }
  return scalarOrArray(values);
}

function signedLongValues(
  reader: TiffReader,
  offset: number,
  count: number,
): number | readonly number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(reader.i32(offset + index * 4));
  }
  return scalarOrArray(values);
}

function rationalValues(
  reader: TiffReader,
  offset: number,
  count: number,
  signed: boolean,
): DecodedTiffValue {
  const diagnostics: Diagnostic[] = [];
  const values: RationalValue[] = [];
  for (let index = 0; index < count; index += 1) {
    const componentOffset = offset + index * 8;
    const numerator = signed
      ? reader.i32(componentOffset)
      : reader.u32(componentOffset);
    const denominator = signed
      ? reader.i32(componentOffset + 4)
      : reader.u32(componentOffset + 4);
    values.push({ numerator, denominator });
    if (denominator === 0) {
      diagnostics.push({
        severity: "error",
        code: "TIFF_INVALID_RATIONAL",
        message: "TIFF rational value has a zero denominator.",
        offset: componentOffset + 4,
      });
    }
  }
  return { value: scalarOrArray(values), diagnostics };
}

export function decodeTiffValue(
  reader: TiffReader,
  type: number,
  count: number,
  valueOffset: number,
  definition: TiffTagDefinition,
): DecodedTiffValue {
  if (count > MAX_DECODED_COMPONENTS && type !== TIFF_FIELD_TYPE.ASCII) {
    return {
      diagnostics: [
        {
          severity: "error",
          code: "TIFF_INVALID_VALUE_RANGE",
          message: `TIFF value has too many components to decode (${String(count)}).`,
          offset: valueOffset,
        },
      ],
    };
  }

  if (definition.special === "exif-version") {
    return { value: ascii(reader, valueOffset, count), diagnostics: [] };
  }

  if (definition.special === "gps-version") {
    const components: number[] = [];
    for (let index = 0; index < count; index += 1) {
      components.push(reader.u8(valueOffset + index));
    }
    return { value: components.join("."), diagnostics: [] };
  }

  switch (type) {
    case TIFF_FIELD_TYPE.ASCII:
      return { value: ascii(reader, valueOffset, count), diagnostics: [] };
    case TIFF_FIELD_TYPE.BYTE:
    case TIFF_FIELD_TYPE.UNDEFINED:
      return {
        value: unsignedValues(reader, valueOffset, count, 1),
        diagnostics: [],
      };
    case TIFF_FIELD_TYPE.SHORT:
      return {
        value: unsignedValues(reader, valueOffset, count, 2),
        diagnostics: [],
      };
    case TIFF_FIELD_TYPE.LONG:
      return {
        value: unsignedValues(reader, valueOffset, count, 4),
        diagnostics: [],
      };
    case TIFF_FIELD_TYPE.SLONG:
      return {
        value: signedLongValues(reader, valueOffset, count),
        diagnostics: [],
      };
    case TIFF_FIELD_TYPE.RATIONAL:
      return rationalValues(reader, valueOffset, count, false);
    case TIFF_FIELD_TYPE.SRATIONAL:
      return rationalValues(reader, valueOffset, count, true);
    default:
      return { diagnostics: [] };
  }
}
