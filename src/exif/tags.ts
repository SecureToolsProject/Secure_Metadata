import type {
  MetadataCategory,
  MetadataNamespace,
  PrivacyRelevance,
} from "../core/types.js";
import type { TiffIfdKind } from "./types.js";

export const TIFF_TAG = {
  IMAGE_DESCRIPTION: 0x010e,
  MAKE: 0x010f,
  MODEL: 0x0110,
  ORIENTATION: 0x0112,
  SOFTWARE: 0x0131,
  DATE_TIME: 0x0132,
  ARTIST: 0x013b,
  COPYRIGHT: 0x8298,
  EXIF_IFD_POINTER: 0x8769,
  GPS_IFD_POINTER: 0x8825,
  EXPOSURE_TIME: 0x829a,
  F_NUMBER: 0x829d,
  ISO_SPEED: 0x8827,
  EXIF_VERSION: 0x9000,
  DATE_TIME_ORIGINAL: 0x9003,
  DATE_TIME_DIGITIZED: 0x9004,
  FOCAL_LENGTH: 0x920a,
  MAKER_NOTE: 0x927c,
  PIXEL_X_DIMENSION: 0xa002,
  PIXEL_Y_DIMENSION: 0xa003,
  FOCAL_LENGTH_35MM: 0xa405,
} as const;

export interface TiffTagDefinition {
  readonly name: string;
  readonly namespace: MetadataNamespace;
  readonly category: MetadataCategory;
  readonly privacy: PrivacyRelevance;
  readonly special?: "exif-version" | "gps-version";
}

const IFD0_TAGS: Readonly<Record<number, TiffTagDefinition>> = {
  [TIFF_TAG.IMAGE_DESCRIPTION]: {
    name: "ImageDescription",
    namespace: "exif",
    category: "description",
    privacy: "potentially-sensitive",
  },
  [TIFF_TAG.MAKE]: {
    name: "Make",
    namespace: "exif",
    category: "device",
    privacy: "potentially-sensitive",
  },
  [TIFF_TAG.MODEL]: {
    name: "Model",
    namespace: "exif",
    category: "device",
    privacy: "potentially-sensitive",
  },
  [TIFF_TAG.ORIENTATION]: {
    name: "Orientation",
    namespace: "exif",
    category: "rendering",
    privacy: "non-sensitive",
  },
  [TIFF_TAG.SOFTWARE]: {
    name: "Software",
    namespace: "exif",
    category: "software",
    privacy: "potentially-sensitive",
  },
  [TIFF_TAG.DATE_TIME]: {
    name: "DateTime",
    namespace: "exif",
    category: "timestamp",
    privacy: "potentially-sensitive",
  },
  [TIFF_TAG.ARTIST]: {
    name: "Artist",
    namespace: "exif",
    category: "identity",
    privacy: "sensitive",
  },
  [TIFF_TAG.COPYRIGHT]: {
    name: "Copyright",
    namespace: "exif",
    category: "rights",
    privacy: "potentially-sensitive",
  },
};

const EXIF_TAGS: Readonly<Record<number, TiffTagDefinition>> = {
  [TIFF_TAG.EXPOSURE_TIME]: technical("ExposureTime"),
  [TIFF_TAG.F_NUMBER]: technical("FNumber"),
  [TIFF_TAG.ISO_SPEED]: technical("PhotographicSensitivity"),
  [TIFF_TAG.EXIF_VERSION]: {
    ...technical("ExifVersion"),
    special: "exif-version",
  },
  [TIFF_TAG.DATE_TIME_ORIGINAL]: timestamp("DateTimeOriginal"),
  [TIFF_TAG.DATE_TIME_DIGITIZED]: timestamp("DateTimeDigitized"),
  [TIFF_TAG.FOCAL_LENGTH]: technical("FocalLength"),
  [TIFF_TAG.PIXEL_X_DIMENSION]: technical("PixelXDimension"),
  [TIFF_TAG.PIXEL_Y_DIMENSION]: technical("PixelYDimension"),
  [TIFF_TAG.FOCAL_LENGTH_35MM]: technical("FocalLengthIn35mmFilm"),
  [TIFF_TAG.MAKER_NOTE]: {
    name: "MakerNote",
    namespace: "exif",
    category: "unknown",
    privacy: "potentially-sensitive",
  },
};

const GPS_TAGS: Readonly<Record<number, TiffTagDefinition>> = {
  0x0000: {
    name: "GPSVersionID",
    namespace: "gps",
    category: "technical",
    privacy: "non-sensitive",
    special: "gps-version",
  },
  0x0001: location("GPSLatitudeRef"),
  0x0002: location("GPSLatitude"),
  0x0003: location("GPSLongitudeRef"),
  0x0004: location("GPSLongitude"),
  0x0005: location("GPSAltitudeRef"),
  0x0006: location("GPSAltitude"),
  0x0007: {
    name: "GPSTimeStamp",
    namespace: "gps",
    category: "timestamp",
    privacy: "potentially-sensitive",
  },
  0x001d: {
    name: "GPSDateStamp",
    namespace: "gps",
    category: "timestamp",
    privacy: "potentially-sensitive",
  },
};

function technical(name: string): TiffTagDefinition {
  return {
    name,
    namespace: "exif",
    category: "technical",
    privacy: "non-sensitive",
  };
}

function timestamp(name: string): TiffTagDefinition {
  return {
    name,
    namespace: "exif",
    category: "timestamp",
    privacy: "potentially-sensitive",
  };
}

function location(name: string): TiffTagDefinition {
  return {
    name,
    namespace: "gps",
    category: "location",
    privacy: "sensitive",
  };
}

export function tiffTagDefinition(
  kind: TiffIfdKind,
  tag: number,
): TiffTagDefinition {
  const definition =
    kind === "gps"
      ? GPS_TAGS[tag]
      : kind === "exif"
        ? EXIF_TAGS[tag]
        : IFD0_TAGS[tag];

  return (
    definition ?? {
      name: `Tag0x${tag.toString(16).toUpperCase().padStart(4, "0")}`,
      namespace: kind === "gps" ? "gps" : "exif",
      category: "unknown",
      privacy: "unknown",
    }
  );
}
