# Format Support

| Capability                  | JPEG                              | PNG       | WebP      |
| --------------------------- | --------------------------------- | --------- | --------- |
| Signature detection         | Supported                         | Supported | Supported |
| Bounded container traversal | Supported                         | Not yet   | Not yet   |
| APP/COM classification      | Supported                         | N/A       | N/A       |
| EXIF container detection    | Supported                         | Not yet   | Not yet   |
| XMP container detection     | Supported, including extended XMP | Not yet   | Not yet   |
| ICC container detection     | Supported                         | Not yet   | Not yet   |
| IPTC/Photoshop detection    | Supported                         | Not yet   | Not yet   |
| Metadata field decoding     | Not yet                           | Not yet   | Not yet   |
| Cleaning                    | Not yet                           | Not yet   | Not yet   |

## JPEG

JPEG detection requires `FF D8`. Container inspection validates marker boundaries and two-byte big-endian declared lengths, recognizes standalone markers and fill bytes, stops at EOI, and reports trailing bytes. SOS headers are traversed, while entropy-coded bytes are skipped without decoding; `FF 00`, RST0–RST7, and multiple scans are handled structurally.

Payload signatures identify:

- APP0 `JFIF\0` and `JFXX\0` as technical container data;
- APP1 `Exif\0\0` as EXIF;
- APP1 standard and extended Adobe XMP identifiers as XMP;
- APP2 `ICC_PROFILE\0` as ICC;
- APP13 `Photoshop 3.0\0` as Photoshop/IPTC;
- APP14 `Adobe` as rendering/container data;
- COM as comment metadata.

Unknown APP payloads remain unknown. No TIFF, EXIF, XMP XML, ICC, IPTC, thumbnail, frame, Huffman, quantization, or entropy payload is decoded.

## PNG and WebP

PNG requires its complete eight-byte signature. WebP requires `RIFF` at offset 0 and `WEBP` at offset 8. Their chunk structures, sizes, CRCs, metadata, and image payloads are not yet parsed.
