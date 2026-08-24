# Architecture

`secure-metadata` is organized as a side-effect-free binary library. Its planned data flow is:

```text
Input bytes                              implemented
    ↓
Safe binary view / bounded reads         implemented
    ↓
Format detection                         implemented
    ↓
Container parser                         planned
    ↓
Metadata decoder                         planned
    ↓
Metadata normalization/classification    planned
    ↓
Inspector / policy engine                planned
    ↓
Cleaner                                  planned
    ↓
Output bytes                              planned
    ↓
Re-inspection / verification             planned
```

## Binary core

All future format parsers build on `src/core/binary`. Input normalization returns the caller's exact `Uint8Array` view or creates a no-copy view over an `ArrayBuffer`. `ByteReader` validates offsets and lengths as non-negative safe integers and checks remaining capacity with subtraction before every read. It provides bounded unsigned 8-, 16-, and 32-bit reads in both endian orders, subarray views, and allocation-free signature matching.

`ByteReader` is an internal implementation primitive, not part of the stable package exports. Its `DataView` is constrained to the input view's `byteOffset` and `byteLength`, and accesses occur only after project-owned bounds validation.

## Layer boundaries

- **Format detection** identifies PNG, JPEG, and WebP signatures in that explicit order. It does not imply structural validity.
- **Container parsing** will identify and bound JPEG segments, PNG chunks, or WebP RIFF chunks without decoding pixels.
- **Metadata decoding** will interpret known metadata payloads. EXIF/TIFF will be one shared decoder reused by JPEG, PNG, and WebP.
- **Normalization and classification** maps format-specific fields to stable namespaces and semantic categories.
- **Privacy relevance** is an independent description of whether an entry can concern privacy. It is not a contextual risk score.
- **Cleaning policy** decides which proven structures to remove while preserving required, color, rendering, image-payload, and unknown data by default.
- **Verification** independently re-inspects cleaner output and compares it with an explicit expectation.

`inspectMetadata` currently stops after detection and returns `inspectionStatus: "format-only"`. Empty entries therefore mean “not decoded,” not “confirmed absent.” Public APIs remain free of filesystem, network, browser-global, and other environmental side effects.
