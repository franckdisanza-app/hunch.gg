import { inflateSync } from "node:zlib";

// Turns text into SVG path data using a WOFF 1 font with TrueType outlines, so a wordmark can be
// an SVG image that never downloads the font. Simple glyphs only (enough for Latin capitals), no
// kerning. Just enough of the OpenType spec: head, hhea, hmtx, maxp, cmap (format 4), loca, glyf.

interface Font {
  unitsPerEm: number;
  glyphFor(char: string): number;
  advance(glyph: number): number;
  outline(glyph: number): { x: number; y: number; on: boolean }[][];
}

export function readWoff(data: Buffer): Font {
  if (data.toString("latin1", 0, 4) !== "wOFF") throw new Error("Not a WOFF 1 file");
  const tableCount = data.readUInt16BE(12);
  const tables = new Map<string, Buffer>();
  for (let i = 0; i < tableCount; i++) {
    const entry = 44 + i * 20;
    const tag = data.toString("latin1", entry, entry + 4);
    const offset = data.readUInt32BE(entry + 4);
    const compLength = data.readUInt32BE(entry + 8);
    const origLength = data.readUInt32BE(entry + 12);
    const raw = data.subarray(offset, offset + compLength);
    tables.set(tag, compLength < origLength ? inflateSync(raw) : raw);
  }
  const table = (tag: string) => {
    const t = tables.get(tag);
    if (!t) throw new Error(`Font has no ${tag} table`);
    return t;
  };

  const head = table("head");
  const unitsPerEm = head.readUInt16BE(18);
  const longLoca = head.readInt16BE(50) === 1;
  const numGlyphs = table("maxp").readUInt16BE(4);
  const numberOfHMetrics = table("hhea").readUInt16BE(34);
  const hmtx = table("hmtx");
  const loca = table("loca");
  const glyf = table("glyf");

  // cmap: the Windows Unicode BMP subtable, format 4.
  const cmap = table("cmap");
  let sub = -1;
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const rec = 4 + i * 8;
    const platform = cmap.readUInt16BE(rec);
    const encoding = cmap.readUInt16BE(rec + 2);
    const offset = cmap.readUInt32BE(rec + 4);
    if (platform === 3 && encoding === 1 && cmap.readUInt16BE(offset) === 4) sub = offset;
  }
  if (sub < 0) throw new Error("Font has no format 4 cmap");
  const segX2 = cmap.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const rangeOffsets = deltas + segX2;

  function glyphFor(char: string): number {
    const code = char.codePointAt(0) ?? 0;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = cmap.readUInt16BE(ends + s * 2);
      if (code > end) continue;
      const start = cmap.readUInt16BE(starts + s * 2);
      if (code < start) return 0;
      const delta = cmap.readInt16BE(deltas + s * 2);
      const rangeOffset = cmap.readUInt16BE(rangeOffsets + s * 2);
      if (rangeOffset === 0) return (code + delta) & 0xffff;
      const at = rangeOffsets + s * 2 + rangeOffset + (code - start) * 2;
      const glyph = cmap.readUInt16BE(at);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  }

  function advance(glyph: number): number {
    const index = Math.min(glyph, numberOfHMetrics - 1);
    return hmtx.readUInt16BE(index * 4);
  }

  function glyphRange(glyph: number): [number, number] {
    if (glyph >= numGlyphs) return [0, 0];
    return longLoca
      ? [loca.readUInt32BE(glyph * 4), loca.readUInt32BE(glyph * 4 + 4)]
      : [loca.readUInt16BE(glyph * 2) * 2, loca.readUInt16BE(glyph * 2 + 2) * 2];
  }

  function outline(glyph: number) {
    const [start, end] = glyphRange(glyph);
    if (start === end) return [];
    const g = glyf.subarray(start, end);
    const contours = g.readInt16BE(0);
    if (contours < 0) throw new Error(`Glyph ${glyph} is composite; not supported`);
    const endPts = Array.from({ length: contours }, (_, i) => g.readUInt16BE(10 + i * 2));
    const pointCount = (endPts[endPts.length - 1] ?? -1) + 1;
    let p = 10 + contours * 2;
    p += 2 + g.readUInt16BE(p); // skip instructions

    const flags: number[] = [];
    while (flags.length < pointCount) {
      const flag = g.readUInt8(p++);
      flags.push(flag);
      if (flag & 8) {
        const repeat = g.readUInt8(p++);
        for (let r = 0; r < repeat; r++) flags.push(flag);
      }
    }
    const coords = (shortBit: number, sameBit: number) => {
      const out: number[] = [];
      let value = 0;
      for (const flag of flags) {
        if (flag & shortBit) {
          const d = g.readUInt8(p++);
          value += flag & sameBit ? d : -d;
        } else if (!(flag & sameBit)) {
          value += g.readInt16BE(p);
          p += 2;
        }
        out.push(value);
      }
      return out;
    };
    const xs = coords(2, 16);
    const ys = coords(4, 32);

    const result: { x: number; y: number; on: boolean }[][] = [];
    let first = 0;
    for (const last of endPts) {
      const contour = [];
      for (let i = first; i <= last; i++)
        contour.push({ x: xs[i]!, y: ys[i]!, on: (flags[i]! & 1) === 1 });
      result.push(contour);
      first = last + 1;
    }
    return result;
  }

  return { unitsPerEm, glyphFor, advance, outline };
}

const r = (n: number) => Math.round(n * 100) / 100;

/** SVG path data for `text` at `size` px, baseline at y = `baseline`, starting at x = 0. */
export function textPath(
  font: Font,
  text: string,
  size: number,
  baseline: number,
  letterSpacing = 0,
): { d: string; width: number } {
  const scale = size / font.unitsPerEm;
  let penX = 0;
  const parts: string[] = [];
  for (const char of text) {
    const glyph = font.glyphFor(char);
    for (const contour of font.outline(glyph)) {
      const pt = (q: { x: number; y: number }) =>
        `${r(penX + q.x * scale)} ${r(baseline - q.y * scale)}`;
      // Start on an on-curve point (or the midpoint of two off-curve points).
      const n = contour.length;
      let startIndex = contour.findIndex((q) => q.on);
      let start: { x: number; y: number };
      if (startIndex === -1) {
        start = {
          x: (contour[0]!.x + contour[n - 1]!.x) / 2,
          y: (contour[0]!.y + contour[n - 1]!.y) / 2,
        };
        startIndex = 0;
      } else {
        start = contour[startIndex]!;
        startIndex += 1;
      }
      let d = `M ${pt(start)}`;
      let control: { x: number; y: number } | null = null;
      for (let k = 0; k < n; k++) {
        const q = contour[(startIndex + k) % n]!;
        if (q.on) {
          d += control ? ` Q ${pt(control)} ${pt(q)}` : ` L ${pt(q)}`;
          control = null;
        } else if (control) {
          const mid = { x: (control.x + q.x) / 2, y: (control.y + q.y) / 2 };
          d += ` Q ${pt(control)} ${pt(mid)}`;
          control = q;
        } else {
          control = q;
        }
      }
      if (control) d += ` Q ${pt(control)} ${pt(start)}`;
      parts.push(`${d} Z`);
    }
    penX += font.advance(glyph) * scale + letterSpacing;
  }
  return { d: parts.join(" "), width: penX - letterSpacing };
}
