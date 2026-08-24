export const TIFF_FIELD_TYPE = {
  BYTE: 1,
  ASCII: 2,
  SHORT: 3,
  LONG: 4,
  RATIONAL: 5,
  UNDEFINED: 7,
  SLONG: 9,
  SRATIONAL: 10,
} as const;

const FIELD_TYPE_SIZES: Readonly<Record<number, number>> = {
  [TIFF_FIELD_TYPE.BYTE]: 1,
  [TIFF_FIELD_TYPE.ASCII]: 1,
  [TIFF_FIELD_TYPE.SHORT]: 2,
  [TIFF_FIELD_TYPE.LONG]: 4,
  [TIFF_FIELD_TYPE.RATIONAL]: 8,
  [TIFF_FIELD_TYPE.UNDEFINED]: 1,
  [TIFF_FIELD_TYPE.SLONG]: 4,
  [TIFF_FIELD_TYPE.SRATIONAL]: 8,
};

export function tiffFieldTypeSize(type: number): number | undefined {
  return FIELD_TYPE_SIZES[type];
}
