// Removes metadata from proof images before they are published: phone photos carry EXIF with the
// GPS position, the time and the device. Pixels are untouched. No dependencies: JPEG segments,
// PNG chunks and WebP (RIFF) chunks are simple to walk.

export type ImageKind = "jpeg" | "png" | "webp";

export function imageKind(data: Uint8Array): ImageKind | null {
  if (data[0] === 0xff && data[1] === 0xd8) return "jpeg";
  if (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a
  )
    return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...data.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

export const CONTENT_TYPES: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * JPEG: drops APP1 (EXIF, XMP), APP13 (IPTC) and comments; keeps APP0 (JFIF), APP2 (ICC colour
 * profile), APP14 (Adobe colour transform) and all image data.
 */
export function stripJpeg(data: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < data.length) {
    if (data[i] !== 0xff) throw new Error("Malformed JPEG");
    const marker = data[i + 1]!;
    // Start of scan: the rest is image data up to the end marker.
    if (marker === 0xda) {
      out.push(...data.subarray(i));
      break;
    }
    const length = (data[i + 2]! << 8) | data[i + 3]!;
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) out.push(...data.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  return Uint8Array.from(out);
}

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

/** PNG: drops eXIf, text chunks and the timestamp. */
export function stripPng(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [data.subarray(0, 8)];
  let i = 8;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  while (i < data.length) {
    const length = view.getUint32(i);
    const type = String.fromCharCode(...data.subarray(i + 4, i + 8));
    const end = i + 12 + length;
    if (!PNG_DROP.has(type)) parts.push(data.subarray(i, end));
    i = end;
  }
  return concat(parts);
}

/** WebP: drops the EXIF and XMP chunks and clears their flags in the VP8X header. */
export function stripWebp(data: Uint8Array): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i < data.length) {
    const type = String.fromCharCode(...data.subarray(i, i + 4));
    const size = view.getUint32(i + 4, true);
    const end = i + 8 + size + (size % 2);
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = data.slice(i, end);
      // VP8X flags: bit 3 EXIF, bit 2 XMP.
      if (type === "VP8X") chunk[8] = chunk[8]! & ~0b1100;
      chunks.push(chunk);
    }
    i = end;
  }
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(data.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return concat([header, body]);
}

export function stripMetadata(data: Uint8Array): { kind: ImageKind; data: Uint8Array } {
  const kind = imageKind(data);
  if (!kind) throw new Error("Not a JPEG, PNG or WebP image");
  const stripped =
    kind === "jpeg" ? stripJpeg(data) : kind === "png" ? stripPng(data) : stripWebp(data);
  return { kind, data: stripped };
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
