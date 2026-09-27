import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { WRITE_RATE_LIMIT } from "./limits";
import { CrowdStoreUnavailableError, getCrowdStore, type CrowdStore } from "./store";

// Shared plumbing for the crowd route handlers: JSON bodies with a size cap, hashed-IP rate
// limiting, cache headers and consistent error responses.

export const NO_STORE = "no-store";

export function json(data: unknown, status = 200, cacheControl = NO_STORE): Response {
  return Response.json(data, { status, headers: { "Cache-Control": cacheControl } });
}

export function problem(status: number, error: string, headers: Record<string, string> = {}) {
  return Response.json({ error }, { status, headers: { "Cache-Control": NO_STORE, ...headers } });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": NO_STORE } });
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Reads a JSON body, refusing anything larger than `maxBytes` before and while reading it. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Expected application/json.");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "Body too large.");
  if (!request.body) throw new HttpError(400, "Missing body.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Body too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}

export function parseWith<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, "Invalid payload.");
  return result.data;
}

/** The client's IP as seen by Vercel's edge (which overwrites these headers), else "unknown". */
export function clientIp(request: Request): string {
  const headers = request.headers;
  const forwarded =
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for") ??
    headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function ipHashSalt(): string {
  const salt = process.env.IP_HASH_SALT;
  if (salt) return salt;
  if (process.env.NODE_ENV === "production") {
    throw new HttpError(503, "IP_HASH_SALT is not configured.");
  }
  return "development-only-salt";
}

/** sha256(ip + IP_HASH_SALT + UTC date): changes daily and cannot be reversed without the salt. */
export function hashIp(ip: string, salt: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}${salt}${day}`).digest("hex");
}

/** Throws a 429 when this client has made too many writes in the current window. */
export async function enforceWriteLimit(request: Request, store: CrowdStore): Promise<void> {
  const key = `write:${hashIp(clientIp(request), ipHashSalt())}`;
  const limited = await store.hitRateLimit(
    key,
    WRITE_RATE_LIMIT.max,
    WRITE_RATE_LIMIT.windowSeconds,
  );
  if (limited) {
    throw new HttpError(429, "Too many requests.");
  }
}

/** Constant-time comparison of a bearer token against `secret`. */
export function bearerMatches(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const actual = createHash("sha256").update(header).digest();
  return timingSafeEqual(expected, actual);
}

/** Runs a handler with the crowd store, mapping known failures to HTTP responses. */
export async function withCrowdStore(
  handler: (store: CrowdStore) => Promise<Response>,
): Promise<Response> {
  try {
    return await handler(getCrowdStore());
  } catch (error) {
    if (error instanceof HttpError) {
      return problem(
        error.status,
        error.message,
        error.status === 429 ? { "Retry-After": String(WRITE_RATE_LIMIT.windowSeconds) } : {},
      );
    }
    if (error instanceof CrowdStoreUnavailableError) return problem(503, error.message);
    console.error("[crowd]", error);
    return problem(500, "Something went wrong.");
  }
}
