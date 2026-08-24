export const JPEG_MARKER = {
  TEM: 0x01,
  SOF0: 0xc0,
  SOF1: 0xc1,
  SOF2: 0xc2,
  DHT: 0xc4,
  SOI: 0xd8,
  EOI: 0xd9,
  SOS: 0xda,
  DQT: 0xdb,
  DRI: 0xdd,
  COM: 0xfe,
} as const;

const MARKER_NAMES: Readonly<Record<number, string>> = {
  [JPEG_MARKER.TEM]: "TEM",
  [JPEG_MARKER.SOF0]: "SOF0",
  [JPEG_MARKER.SOF1]: "SOF1",
  [JPEG_MARKER.SOF2]: "SOF2",
  [JPEG_MARKER.DHT]: "DHT",
  [JPEG_MARKER.SOI]: "SOI",
  [JPEG_MARKER.EOI]: "EOI",
  [JPEG_MARKER.SOS]: "SOS",
  [JPEG_MARKER.DQT]: "DQT",
  [JPEG_MARKER.DRI]: "DRI",
  [JPEG_MARKER.COM]: "COM",
};

export function isApplicationMarker(marker: number): boolean {
  return marker >= 0xe0 && marker <= 0xef;
}

export function isRestartMarker(marker: number): boolean {
  return marker >= 0xd0 && marker <= 0xd7;
}

export function isStandaloneMarker(marker: number): boolean {
  return (
    marker === JPEG_MARKER.TEM ||
    marker === JPEG_MARKER.SOI ||
    marker === JPEG_MARKER.EOI ||
    isRestartMarker(marker)
  );
}

export function isValidMarkerCode(marker: number): boolean {
  return marker === JPEG_MARKER.TEM || (marker >= 0xc0 && marker <= 0xfe);
}

export function markerName(marker: number): string {
  if (isApplicationMarker(marker)) {
    return `APP${String(marker - 0xe0)}`;
  }

  if (isRestartMarker(marker)) {
    return `RST${String(marker - 0xd0)}`;
  }

  return MARKER_NAMES[marker] ?? `UNKNOWN_${marker.toString(16).toUpperCase()}`;
}
