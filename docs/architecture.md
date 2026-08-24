# Architecture

`secure-metadata` is organized as a side-effect-free binary library. Its planned data flow is:

```text
Input bytes
    ↓
Format detection
    ↓
Container parser
    ↓
Metadata decoder
    ↓
Metadata normalization/classification
    ↓
Inspector / policy engine
    ↓
Cleaner
    ↓
Output bytes
    ↓
Re-inspection / verification
```

## Layer boundaries

- **Container parsing** identifies and bounds JPEG segments, PNG chunks, or WebP RIFF chunks without decoding pixels.
- **Metadata decoding** interprets known metadata payloads. EXIF/TIFF will be one shared decoder reused by JPEG, PNG, and WebP.
- **Normalization and classification** maps format-specific fields to stable namespaces and semantic categories.
- **Privacy relevance** is an independent description of whether an entry can concern privacy. It is not a contextual risk score.
- **Cleaning policy** decides which proven structures to remove while preserving required, color, rendering, image-payload, and unknown data by default.
- **Verification** independently re-inspects cleaner output and compares it with an explicit expectation.

Format packages will depend on bounded primitives in `src/core/binary`. Decoders and policy code must not perform ad hoc binary reads. Public APIs accept bytes and return values without filesystem, network, browser-global, or other environmental side effects.

Sprint 0 establishes interfaces and boundaries only. Format detection, binary primitives, parsers, decoders, cleaning, and verification logic are intentionally not implemented.
