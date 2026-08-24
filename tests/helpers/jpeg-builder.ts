export const MARKER = {
  SOI: 0xd8,
  EOI: 0xd9,
  SOS: 0xda,
  DHT: 0xc4,
  DQT: 0xdb,
  COM: 0xfe,
  APP0: 0xe0,
  APP1: 0xe1,
  APP2: 0xe2,
  APP13: 0xed,
  APP14: 0xee,
} as const;

export function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

export function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function marker(code: number, fillBytes = 1): Uint8Array {
  return Uint8Array.from([...new Uint8Array(fillBytes).fill(0xff), code]);
}

export function segment(
  code: number,
  payload: Uint8Array = new Uint8Array(),
  fillBytes = 1,
): Uint8Array {
  const declaredLength = payload.byteLength + 2;
  return concat(
    marker(code, fillBytes),
    Uint8Array.of(Math.floor(declaredLength / 0x100), declaredLength % 0x100),
    payload,
  );
}

export function jpeg(...parts: readonly Uint8Array[]): Uint8Array {
  return concat(marker(MARKER.SOI), ...parts, marker(MARKER.EOI));
}

export const EXIF = concat(ascii("Exif"), Uint8Array.of(0, 0));
export const XMP = concat(
  ascii("http://ns.adobe.com/xap/1.0/"),
  Uint8Array.of(0),
);
export const EXTENDED_XMP = concat(
  ascii("http://ns.adobe.com/xmp/extension/"),
  Uint8Array.of(0),
);
export const ICC = concat(ascii("ICC_PROFILE"), Uint8Array.of(0));
export const PHOTOSHOP = concat(ascii("Photoshop 3.0"), Uint8Array.of(0));
export const JFIF = concat(ascii("JFIF"), Uint8Array.of(0));
export const JFXX = concat(ascii("JFXX"), Uint8Array.of(0));
export const ADOBE = ascii("Adobe");
