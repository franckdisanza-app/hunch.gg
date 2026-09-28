import { getCrowdStore } from "@/lib/crowd/store";
import { json } from "@/lib/crowd/http";

export const runtime = "nodejs";

/** Checks that the crowd database answers. 200 when it does, 503 otherwise. */
export async function GET() {
  try {
    const store = getCrowdStore();
    await store.ping();
    return json({ ok: true, store: store.kind });
  } catch (error) {
    console.error("[health]", error);
    return json({ ok: false }, 503);
  }
}
