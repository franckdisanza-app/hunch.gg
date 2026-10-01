// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import * as z from "zod/mini";
import { playerStorage } from "@/lib/storage";
import { META_KEY } from "@/lib/storage-keys";
import { gameMetadata } from "./game-route";
import { strings } from "./strings";
import { saveGamePref, useGamePref, type GamePref } from "./prefs";
import { prefetchJson, puzzleUrl, useJson } from "./useJson";

const schema = z.object({ fake: z.string() });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("useJson", () => {
  it("validates the document with the schema", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ fake: "Fake puzzle" })));
    const { result } = renderHook(() => useJson("/api/fake", schema));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current).toMatchObject({ status: "ready" }));
    expect(result.current).toMatchObject({ data: { fake: "Fake puzzle" } });
  });

  it("tells a missing document from a broken one", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(null, 404))
        .mockResolvedValueOnce(json({ wrong: 1 })),
    );
    const missing = renderHook(() => useJson("/api/fake/1", schema));
    await waitFor(() => expect(missing.result.current.status).toBe("missing"));
    const broken = renderHook(() => useJson("/api/fake/2", schema));
    await waitFor(() => expect(broken.result.current.status).toBe("error"));
  });

  it("uses a prefetched request for the same URL once, and fetches again on retry", async () => {
    const fetch = vi.fn(async () => json({ fake: "Fake prefetched" }));
    vi.stubGlobal("fetch", fetch);
    const early = prefetchJson("/api/fake");
    expect(fetch).toHaveBeenCalledTimes(1);
    const { result } = renderHook(() => useJson("/api/fake", schema, early));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("fetches again when the prefetched request failed on the network", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockImplementation(async () => json({ fake: "Fake second try" }));
    vi.stubGlobal("fetch", fetch);
    const early = prefetchJson("/api/fake");
    const { result } = renderHook(() => useJson("/api/fake", schema, early));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never leaves a failed prefetch unhandled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    prefetchJson("/api/fake");
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("builds puzzle API URLs", () => {
    expect(puzzleUrl("fake-game", 12)).toBe("/api/puzzle/fake-game/12");
  });
});

describe("useGamePref", () => {
  const pref: GamePref<"a" | "b"> = {
    key: "fakePref",
    is: (value): value is "a" | "b" => value === "a" || value === "b",
    browserDefault: () => "b",
    serverDefault: "a",
  };

  it("falls back to the browser default, then follows the saved choice", () => {
    act(() => void playerStorage().getMeta());
    const { result } = renderHook(() => useGamePref(pref));
    expect(result.current).toBe("b");
    act(() => saveGamePref(pref, "a"));
    expect(result.current).toBe("a");
    expect(JSON.parse(window.localStorage.getItem(META_KEY) ?? "{}").prefs).toEqual({
      fakePref: "a",
    });
  });

  it("ignores a stored value that is no longer valid", () => {
    act(() => {
      playerStorage().getMeta();
      playerStorage().updateMeta({ prefs: { fakePref: "retired" } });
    });
    const { result } = renderHook(() => useGamePref(pref));
    expect(result.current).toBe("b");
  });
});

describe("gameMetadata", () => {
  it("describes a reachable game and hides one that is not", () => {
    expect(
      gameMetadata("sticker-shock", { title: "Fake title", description: "Fake", path: "/fake" }),
    ).toEqual({ title: "Fake title", description: "Fake", alternates: { canonical: "/fake" } });
    expect(
      gameMetadata("no-such-game", { title: "Fake title", description: "Fake", path: "/fake" }),
    ).toEqual({ title: strings.notFound.title });
  });
});
