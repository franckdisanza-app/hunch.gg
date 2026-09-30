import { SpoilerError, buildShareText, shareText, shareUrl } from "./share";

const input = {
  gameName: "Demo Game",
  slug: "demo-game",
  puzzle: 12,
  score: { value: 4, max: 5 },
  grid: "🟩🟩🟥🟩🟩",
  teaser: "Which fake item costs more today?",
  baseUrl: "https://example.test",
};

describe("buildShareText", () => {
  it("has the four parts in order", () => {
    expect(buildShareText(input).split("\n")).toEqual([
      "Demo Game #12 · 4/5",
      "🟩🟩🟥🟩🟩",
      "Which fake item costs more today?",
      "https://example.test/demo-game?ref=share",
    ]);
  });

  it("shares an unlimited run as one line and the link", () => {
    const text = buildShareText({
      gameName: "Demo Game",
      slug: "demo-game",
      run: { mode: "Endless", result: "streak 14" },
      baseUrl: "https://example.test",
    });
    expect(text.split("\n")).toEqual([
      "Demo Game Endless · streak 14",
      "https://example.test/demo-game?ref=share",
    ]);
  });

  it("always writes the score in numbers", () => {
    const text = buildShareText({ ...input, score: { value: 812 } });
    expect(text.split("\n")[0]).toBe("Demo Game #12 · 812");
    const big = buildShareText({ ...input, score: { value: 2140, max: 3000 } });
    expect(big.split("\n")[0]).toBe("Demo Game #12 · 2,140/3,000");
  });

  it("builds links from the site URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plimp.lol/");
    expect(shareUrl("demo-game")).toBe("https://plimp.lol/demo-game?ref=share");
  });

  it("refuses to spoil an answer outside production", () => {
    expect(() =>
      buildShareText({ ...input, teaser: "Was it the Fake Widget?", spoilers: ["fake widget"] }),
    ).toThrow(SpoilerError);
  });

  it("drops a spoiling line in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const text = buildShareText({
      ...input,
      teaser: "Was it the Fake Widget?",
      spoilers: ["Fake Widget"],
    });
    expect(text).not.toMatch(/widget/i);
    expect(text.split("\n")).toHaveLength(3);
  });
});

describe("shareText", () => {
  it("uses the Web Share API when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });
    expect(await shareText("hello")).toBe("native");
    expect(share).toHaveBeenCalledWith({ text: "hello" });
  });

  it("reports a cancelled share without copying", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")),
      clipboard: { writeText },
    });
    expect(await shareText("hello")).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await shareText("hello")).toBe("clipboard");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("reports failure when nothing works", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    expect(await shareText("hello")).toBe("failed");
  });
});
