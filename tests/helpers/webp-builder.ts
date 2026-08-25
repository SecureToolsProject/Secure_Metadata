export function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export function fourCC(value: string): Uint8Array {
  if (value.length !== 4) {
    throw new Error("Test FourCC must contain exactly four characters.");
  }
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

export function u32le(value: number): Uint8Array {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value, true);
  return output;
}

export function chunk(
  type: string,
  payload: Uint8Array<ArrayBufferLike> = new Uint8Array(),
  paddingByte = 0,
): Uint8Array {
  return concat(
    fourCC(type),
    u32le(payload.byteLength),
    payload,
    payload.byteLength % 2 === 1
      ? Uint8Array.of(paddingByte)
      : new Uint8Array(),
  );
}

export function vp8x(
  flags: number,
  remainingPayload: Uint8Array<ArrayBuffer> = Uint8Array.of(
    0,
    0,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
  ),
): Uint8Array {
  return chunk("VP8X", concat(Uint8Array.of(flags), remainingPayload));
}

export function webp(
  chunks: readonly Uint8Array[],
  trailing = new Uint8Array(),
): Uint8Array {
  const body = concat(fourCC("WEBP"), ...chunks);
  return concat(fourCC("RIFF"), u32le(body.byteLength), body, trailing);
}

export function withRiffSize(input: Uint8Array, size: number): Uint8Array {
  const output = Uint8Array.from(input);
  new DataView(output.buffer).setUint32(4, size, true);
  return output;
}
