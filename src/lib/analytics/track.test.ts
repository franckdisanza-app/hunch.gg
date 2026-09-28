// @vitest-environment jsdom
import { dueReturnDays } from "./return-day";
import { parseShareArrival } from "./share-arrival";
import {
  cleanProps,
  flushAnalytics,
  resetAnalyticsForTests,
  setAnalyticsProvider,
  track,
} from "./track";

afterEach(() => {
  resetAnalyticsForTests();
  delete window.plausible;
  delete window.umami;
  delete window.va;
  delete window.vaq;
});

describe("track", () => {
  it("sends nothing with the none provider", () => {
    const plausible = vi.fn();
    window.plausible = plausible;
    track("share_arrival", { game: "demo" });
    expect(plausible).not.toHaveBeenCalled();
  });

  it("dispatches to Plausible", () => {
    const plausible = vi.fn();
    window.plausible = plausible;
    setAnalyticsProvider("plausible");
    track("game_complete", { game: "demo", mode: "daily", puzzle: 3, score: 4 });
    expect(plausible).toHaveBeenCalledWith("game_complete", {
      props: { game: "demo", mode: "daily", puzzle: 3, score: 4 },
    });
  });

  it("dispatches to Umami", () => {
    const umamiTrack = vi.fn();
    window.umami = { track: umamiTrack };
    setAnalyticsProvider("umami");
    track("poll_vote", { poll: "demo:1" });
    expect(umamiTrack).toHaveBeenCalledWith("poll_vote", { poll: "demo:1" });
  });

  it("dispatches to Vercel through its queue stub", () => {
    setAnalyticsProvider("vercel");
    track("return_day", { day: 7 });
    expect(window.vaq).toEqual([["event", { name: "return_day", data: { day: 7 } }]]);
  });

  it("queues events until the provider script has loaded", () => {
    setAnalyticsProvider("plausible");
    track("share_click", { game: "demo", method: "clipboard" });
    const plausible = vi.fn();
    window.plausible = plausible;
    flushAnalytics();
    expect(plausible).toHaveBeenCalledWith("share_click", {
      props: { game: "demo", method: "clipboard" },
    });
  });

  it("omits null props such as the puzzle number in unlimited mode", () => {
    const plausible = vi.fn();
    window.plausible = plausible;
    setAnalyticsProvider("plausible");
    track("game_start", { game: "demo", mode: "unlimited", puzzle: null });
    expect(plausible).toHaveBeenCalledWith("game_start", {
      props: { game: "demo", mode: "unlimited" },
    });
  });
});

describe("cleanProps", () => {
  it("never passes a device ID or free text", () => {
    expect(
      cleanProps({
        game: "demo",
        deviceId: "123e4567-e89b-42d3-a456-426614174000",
        message: "the price was wrong, my email is someone@example.test",
        score: 3,
        bad: Number.NaN,
      }),
    ).toEqual({ game: "demo", score: 3 });
  });
});

describe("dueReturnDays", () => {
  it("fires each milestone once, counted from the first visit", () => {
    expect(dueReturnDays("2026-01-01", "2026-01-01", [])).toEqual([]);
    expect(dueReturnDays("2026-01-01", "2026-01-02", [])).toEqual([1]);
    expect(dueReturnDays("2026-01-01", "2026-01-09", [1])).toEqual([7]);
    expect(dueReturnDays("2026-01-01", "2026-02-15", [])).toEqual([1, 7, 30]);
    expect(dueReturnDays("2026-01-01", "2026-02-15", [1, 7, 30])).toEqual([]);
  });
});

describe("parseShareArrival", () => {
  const isGame = (slug: string) => slug === "demo";

  it("detects ?ref=share and strips it", () => {
    expect(parseShareArrival("https://example.test/demo?ref=share&x=1#top", isGame)).toEqual({
      game: "demo",
      cleanUrl: "/demo?x=1#top",
    });
  });

  it("attributes unknown paths to the shelf", () => {
    expect(parseShareArrival("https://example.test/?ref=share", isGame)?.game).toBe("shelf");
  });

  it("ignores other links", () => {
    expect(parseShareArrival("https://example.test/demo?ref=other", isGame)).toBeNull();
  });
});
