import { deflateSync } from "node:zlib";
import { imageKind, stripJpeg, stripMetadata, stripPng, stripWebp } from "./image-metadata";

// Tiny hand-built images: the bytes that matter are the metadata segments, which carry fake
// "GPS" text so the test can check they are gone.

const bytes = (...parts: (number[] | string | Uint8Array)[]) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : [...p])),
  );
const has = (data: Uint8Array, text: string) => Buffer.from(data).includes(Buffer.from(text));

function jpegSegment(marker: number, payload: string): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...Buffer.from(payload, "latin1")];
}

describe("JPEG", () => {
  const jpeg = bytes(
    [0xff, 0xd8],
    jpegSegment(0xe0, "JFIF\0keep"),
    jpegSegment(0xe1, "Exif\0\0FAKE-GPS 47.3N 8.5E"),
    jpegSegment(0xe2, "ICC_PROFILE\0keep"),
    jpegSegment(0xfe, "fake comment"),
    [0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9],
  );

  it("drops EXIF and comments but keeps JFIF, the colour profile and the image data", () => {
    const out = stripJpeg(jpeg);
    expect(has(out, "FAKE-GPS")).toBe(false);
    expect(has(out, "fake comment")).toBe(false);
    expect(has(out, "JFIF")).toBe(true);
    expect(has(out, "ICC_PROFILE")).toBe(true);
    expect([...out.subarray(-5)]).toEqual([0x11, 0x22, 0x33, 0xff, 0xd9]);
    expect(imageKind(out)).toBe("jpeg");
  });
});

describe("PNG", () => {
  function chunk(type: string, data: Uint8Array | string): Uint8Array {
    const body = typeof data === "string" ? Buffer.from(data, "latin1") : data;
    const out = new Uint8Array(12 + body.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, body.length);
    out.set(Buffer.from(type, "latin1"), 4);
    out.set(body, 8);
    return out; // CRC left at zero: the stripper never checks it.
  }
  const png = bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    chunk("IHDR", new Uint8Array(13)),
    chunk("tEXt", "Comment\0FAKE-GPS"),
    chunk("eXIf", "FAKE-GPS exif"),
    chunk("IDAT", deflateSync(Buffer.alloc(4))),
    chunk("IEND", ""),
  );

  it("drops text and EXIF chunks and keeps the image", () => {
    const out = stripPng(png);
    expect(has(out, "FAKE-GPS")).toBe(false);
    expect(has(out, "IHDR")).toBe(true);
    expect(has(out, "IDAT")).toBe(true);
    expect(has(out, "IEND")).toBe(true);
  });
});

describe("WebP", () => {
  function chunk(type: string, data: number[] | string): number[] {
    const body = typeof data === "string" ? [...Buffer.from(data, "latin1")] : data;
    const size = body.length;
    return [
      ...Buffer.from(type, "latin1"),
      size & 0xff,
      (size >> 8) & 0xff,
      (size >> 16) & 0xff,
      size >>> 24,
      ...body,
      ...(size % 2 ? [0] : []),
    ];
  }
  const body = [
    ...chunk("VP8X", [0b00001100, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ...chunk("VP8 ", [1, 2, 3, 4]),
    ...chunk("EXIF", "FAKE-GPS"),
    ...chunk("XMP ", "<fake>GPS</fake>"),
  ];
  const size = body.length + 4;
  const webp = bytes("RIFF", [size & 0xff, (size >> 8) & 0xff, 0, 0], "WEBP", body);

  it("drops EXIF and XMP, clears their flags and fixes the RIFF size", () => {
    const out = stripWebp(webp);
    expect(has(out, "FAKE-GPS")).toBe(false);
    expect(has(out, "<fake>")).toBe(false);
    expect(out[20]! & 0b1100).toBe(0);
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
    expect(imageKind(out)).toBe("webp");
  });
});

it("rejects anything that is not an image", () => {
  expect(() => stripMetadata(Buffer.from("fake text file"))).toThrow(/Not a JPEG, PNG or WebP/);
});
