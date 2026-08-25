import { pngCrc32 } from "../../src/png/crc32.js";

export const PNG_SIGNATURE = Uint8Array.of(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
);

export function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((length, part) => length + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

export function u32be(value: number): Uint8Array {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value, false);
  return output;
}

export function chunk(
  type: string,
  data: Uint8Array = new Uint8Array(),
  crc?: number,
): Uint8Array {
  const typedData = concat(ascii(type), data);
  return concat(
    u32be(data.byteLength),
    typedData,
    u32be(crc ?? pngCrc32(typedData)),
  );
}

export function png(
  chunks: readonly Uint8Array[],
  trailing: Uint8Array = new Uint8Array(),
): Uint8Array {
  return concat(PNG_SIGNATURE, ...chunks, trailing);
}

export function textChunk(keyword: string, text = "value"): Uint8Array {
  return chunk("tEXt", concat(ascii(keyword), Uint8Array.of(0), ascii(text)));
}

export function ztxtChunk(keyword: string): Uint8Array {
  return chunk("zTXt", concat(ascii(keyword), Uint8Array.of(0, 0, 0x78, 0x9c)));
}

export function itxtChunk(
  keyword: string,
  text = "value",
  compressed = false,
): Uint8Array {
  return chunk(
    "iTXt",
    concat(
      ascii(keyword),
      Uint8Array.of(0, compressed ? 1 : 0, 0, 0, 0),
      ascii(text),
    ),
  );
}
