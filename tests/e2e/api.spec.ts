import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// API smoke test against the production build, using the documented in-memory crowd store
// (CROWD_STORE=memory in playwright.config.ts). The same routes run against Supabase in
// production; the SQL itself is covered by tests/unit/sql with PGlite.

const run = randomUUID().slice(0, 8);
const ip = () => `192.0.2.${Math.floor(Math.random() * 250) + 1}`;

test.describe.configure({ mode: "serial" });

test("health reports the store", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true, store: "memory" });
});

test("votes are validated, deduplicated and hidden below the minimum sample", async ({
  request,
}) => {
  const pollId = `sticker-shock:e2e-${run}`;
  const vote = { game: "sticker-shock", pollId, option: "a", deviceId: randomUUID() };
  const headers = { "x-forwarded-for": ip() };

  expect((await request.post("/api/vote", { data: vote, headers })).status()).toBe(204);
  expect(
    (await request.post("/api/vote", { data: { ...vote, option: "b" }, headers })).status(),
  ).toBe(204);
  expect(
    (await request.post("/api/vote", { data: { ...vote, deviceId: "nope" }, headers })).status(),
  ).toBe(400);
  expect(
    (await request.post("/api/vote", { data: { ...vote, game: "nope" }, headers })).status(),
  ).toBe(404);

  const results = await request.get(`/api/results?poll=${pollId}`);
  expect(await results.json()).toEqual({ ready: false, n: 1 });
});

test("guesses and reports are accepted, crowd stats stay hidden below the minimum", async ({
  request,
}) => {
  const headers = { "x-forwarded-for": ip() };
  const guess = {
    game: "fair-guess",
    puzzle: 1,
    itemId: `e2e-${run}`,
    value: 12,
    deviceId: randomUUID(),
  };
  expect((await request.post("/api/guess", { data: guess, headers })).status()).toBe(204);
  const crowd = await request.get(`/api/crowd?game=fair-guess&puzzle=1&item=e2e-${run}`);
  expect(await crowd.json()).toEqual({ ready: false, n: 1 });

  const report = { game: "fair-guess", itemId: `e2e-${run}`, message: "A fake e2e report." };
  expect((await request.post("/api/report", { data: report, headers })).status()).toBe(204);
});

test("writes are rate-limited per IP", async ({ request }) => {
  const headers = { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}` };
  const statuses: number[] = [];
  for (let i = 0; i < 31; i++) {
    const vote = {
      game: "sticker-shock",
      pollId: `sticker-shock:rl-${run}`,
      option: "a",
      deviceId: randomUUID(),
    };
    statuses.push((await request.post("/api/vote", { data: vote, headers })).status());
  }
  expect(statuses.slice(0, 30).every((s) => s === 204)).toBe(true);
  expect(statuses[30]).toBe(429);
});

test("the cron route rejects requests without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/freeze")).status()).toBe(401);
  expect(
    (
      await request.get("/api/cron/freeze", { headers: { authorization: "Bearer wrong" } })
    ).status(),
  ).toBe(401);
  const ok = await request.get("/api/cron/freeze", {
    headers: { authorization: "Bearer e2e-only-cron-secret" },
  });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ frozen: expect.any(Number) });
});

test("the puzzle API 404s unknown games and unreleased puzzles without caching", async ({
  request,
}) => {
  for (const path of ["/api/puzzle/nope/1", "/api/puzzle/sticker-shock/9999"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
});
