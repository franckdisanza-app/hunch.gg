// pnpm sticker-shock:proofs [--dir content/sticker-shock/proofs-inbox] [--dry-run]
//
// Uploads proof images to the public Supabase Storage bucket `proofs` and writes their URLs into
// prices.csv (column proofImage). Name each file after its price ID: jp-eggs-01.jpg. Metadata
// (EXIF with GPS, XMP, text chunks) is removed before upload; files are named by content, so a
// corrected image gets a new URL and never fights a cached one. Needs SUPABASE_URL and
// SUPABASE_SECRET_KEY. Then run pnpm sticker-shock:build.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseCsv } from "@/lib/content/csv";
import { BUCKET, prepareProof, priceIdOf, withProofUrls, type PreparedProof } from "./lib/proofs";
import { scriptSupabase } from "../lib/supabase";

const root = process.cwd();
const { values } = parseArgs({
  options: {
    dir: { type: "string", default: join("content", "sticker-shock", "proofs-inbox") },
    "dry-run": { type: "boolean", default: false },
  },
});

const inbox = join(root, values.dir);
const csvFile = join(root, "content", "sticker-shock", "prices.csv");
if (!existsSync(inbox)) {
  console.error(`No folder ${values.dir}. Put proof images there, named <price id>.jpg|png|webp.`);
  process.exit(1);
}

const csv = readFileSync(csvFile, "utf8");
const [header = [], ...rows] = parseCsv(csv);
const idColumn = header.indexOf("id");
const priceIds = new Set(rows.map((row) => row[idColumn]?.trim() ?? ""));

const prepared: PreparedProof[] = [];
const problems: string[] = [];
for (const file of readdirSync(inbox).sort()) {
  if (file.startsWith(".")) continue;
  const id = priceIdOf(file);
  if (!id) {
    problems.push(`${file}: name it <price id>.jpg, .png or .webp`);
    continue;
  }
  if (!priceIds.has(id)) {
    problems.push(`${file}: no price with id "${id}" in prices.csv`);
    continue;
  }
  try {
    prepared.push(prepareProof(id, readFileSync(join(inbox, file))));
  } catch (error) {
    problems.push(`${file}: ${(error as Error).message}`);
  }
}

for (const problem of problems) console.warn(`skip     ${problem}`);
if (values["dry-run"]) {
  for (const p of prepared) console.log(`would upload ${p.path} (${p.data.length} bytes)`);
  process.exit(0);
}

const db = scriptSupabase();
const storage = db.storage.from(BUCKET);
const urls = new Map<string, string>();
for (const proof of prepared) {
  const { error } = await storage.upload(proof.path, proof.data, {
    contentType: proof.contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  // The same content was uploaded before: same name, same URL.
  if (error && !/exists|duplicate/i.test(error.message)) {
    console.error(`error    ${proof.path}: ${error.message}`);
    continue;
  }
  urls.set(proof.priceId, storage.getPublicUrl(proof.path).data.publicUrl);
  console.log(`uploaded ${proof.path}`);
}

writeFileSync(csvFile, withProofUrls(csv, urls));
console.log(
  `\n${urls.size} proofs uploaded and linked in prices.csv, ${problems.length} skipped. ` +
    `Now run: pnpm sticker-shock:build`,
);
