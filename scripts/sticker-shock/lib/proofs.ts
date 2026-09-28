import { createHash } from "node:crypto";
import { parseCsv } from "@/lib/content/csv";
import { CONTENT_TYPES, stripMetadata, type ImageKind } from "./image-metadata";
import { toCsv } from "./prices-csv";

// The logic behind `pnpm sticker-shock:proofs`: match proof files to prices, clean them, name them
// by content, and write their public URLs back into prices.csv.

/** Proofs are published at most this big, after metadata is removed. */
export const MAX_PROOF_BYTES = 1_500_000;
export const BUCKET = "proofs";

const EXTENSIONS: Record<ImageKind, string> = { jpeg: "jpg", png: "png", webp: "webp" };

export interface PreparedProof {
  priceId: string;
  /** Path in the bucket: sticker-shock/<price id>-<content hash>.<ext>. */
  path: string;
  contentType: string;
  data: Uint8Array;
}

/** "jp-eggs-01.jpg" → "jp-eggs-01". */
export function priceIdOf(fileName: string): string | null {
  const match = /^([a-z0-9][a-z0-9-]{0,63})\.(jpe?g|png|webp)$/i.exec(fileName);
  return match ? match[1]!.toLowerCase() : null;
}

export function prepareProof(priceId: string, raw: Uint8Array): PreparedProof {
  const { kind, data } = stripMetadata(raw);
  if (data.length > MAX_PROOF_BYTES) {
    throw new Error(
      `${priceId}: ${(data.length / 1e6).toFixed(1)} MB after cleaning; export it smaller (max ${MAX_PROOF_BYTES / 1e6} MB)`,
    );
  }
  const hash = createHash("sha256").update(data).digest("hex").slice(0, 10);
  return {
    priceId,
    path: `sticker-shock/${priceId}-${hash}.${EXTENSIONS[kind]}`,
    contentType: CONTENT_TYPES[kind],
    data,
  };
}

/** prices.csv with proofImage set for the given price IDs; every other cell is kept as is. */
export function withProofUrls(csv: string, urls: ReadonlyMap<string, string>): string {
  const [header, ...rows] = parseCsv(csv);
  if (!header) throw new Error("prices.csv is empty");
  const idColumn = header.indexOf("id");
  const proofColumn = header.indexOf("proofImage");
  if (idColumn < 0 || proofColumn < 0)
    throw new Error("prices.csv needs id and proofImage columns");
  const objects = rows.map((cells) => {
    const row = Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""]));
    const url = urls.get(row.id ?? "");
    return url ? { ...row, proofImage: url } : row;
  });
  return toCsv(header, objects);
}
