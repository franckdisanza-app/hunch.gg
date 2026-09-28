// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/frame/ui/Toast";
import { getGame } from "@/games/registry";
import { deviceTimeZone, puzzleNumber } from "@/lib/daily";
import { playerStorage } from "@/lib/storage";
import { gameKey } from "@/lib/storage-keys";
import { fakeCatalog } from "./__fixtures__/fake-catalog";
import { dailyPuzzle, generatorPrice, pricedItem, ratesFor } from "./catalog";
import { DailyGame } from "./components/Daily";
import { generateDays } from "./generator";
import { StickerShockShell } from "./StickerShockShell";

// A full Daily 10 on a fake day, in jsdom. The real browser run is in tests/e2e.

const today = puzzleNumber(getGame("sticker-shock")!.launchDate!, Date.now(), deviceTimeZone());

function fakeDay() {
  const catalog = fakeCatalog();
  const rates = ratesFor(catalog.prices, catalog.fx);
  const priced = new Map(catalog.prices.map((p) => [p.id, pricedItem(p, catalog)]));
  const [day] = generateDays({
    prices: [...priced.values()].map((p) => generatorPrice(p, rates)),
    from: today,
    to: today,
  });
  return dailyPuzzle(day!, priced, catalog.fx, catalog.polls);
}

let puzzleStatus = 200;
const day = fakeDay();

beforeEach(() => {
  window.localStorage.clear();
  puzzleStatus = 200;
  // Reduced motion: reveals are instant.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/puzzle/")) {
        return puzzleStatus === 200
          ? new Response(JSON.stringify(day))
          : new Response("{}", { status: puzzleStatus });
      }
      if (url.startsWith("/api/results"))
        return new Response(JSON.stringify({ ready: false, n: 0 }));
      return new Response(null, { status: 204 });
    }),
  );
  // Skip the first-visit how-to sheet.
  playerStorage().updateMeta({ howToSeen: ["sticker-shock"] });
});

function renderDaily() {
  return render(
    <ToastProvider>
      <StickerShockShell mode="daily" fontClassName="">
        <DailyGame />
      </StickerShockShell>
    </ToastProvider>,
  );
}

const guesses = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/guess")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));

function playPair(key: "a" | "b") {
  act(() => void fireEvent.keyDown(window, { key }));
  act(
    () => void fireEvent.click(screen.getByRole("button", { name: /Next pair|See the receipt/ })),
  );
}

describe("Sticker Shock daily", () => {
  it("plays ten pairs to the receipt, posting one guess per pair", async () => {
    renderDaily();
    await screen.findByRole("region", { name: "Pair 1 of 10" });
    expect(screen.getByRole("note")).toHaveTextContent("Sample data — not real prices");

    for (let i = 0; i < 10; i++) {
      await screen.findByRole("region", { name: `Pair ${i + 1} of 10` });
      playPair(i % 2 ? "b" : "a");
    }

    expect(await screen.findByRole("heading", { name: "Your receipt" })).toBeInTheDocument();
    expect(screen.getByText("PLIMP - FOOD PRICE")).toBeInTheDocument();
    expect(screen.getByText("THANK YOU FOR SHOPPING")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play Endless" })).toBeInTheDocument();
    expect(screen.getByText(day.poll!.question)).toBeInTheDocument();

    const sent = guesses();
    expect(sent).toHaveLength(10);
    expect(sent.map((g) => g.itemId)).toEqual(day.pairs.map((p) => p.id));
    expect(sent.every((g) => g.game === "sticker-shock" && g.puzzle === today)).toBe(true);
    expect(sent.every((g) => g.value === 0 || g.value === 1)).toBe(true);

    const stats = JSON.parse(window.localStorage.getItem(gameKey("sticker-shock", "stats"))!);
    expect(stats).toMatchObject({ played: 1, completed: 1, currentStreak: 1 });
  });

  it("announces each reveal and moves focus to Next", async () => {
    renderDaily();
    await screen.findByRole("region", { name: "Pair 1 of 10" });
    act(() => void fireEvent.keyDown(window, { key: "a" }));
    expect(screen.getByRole("button", { name: "Next pair" })).toHaveFocus();
    const live = document.querySelector("[aria-live='polite']")!;
    expect(live.textContent).toMatch(/^(Right|Wrong)\. .+: .+\. .+: .+\.$/);
    expect(screen.getByText(/^Turns out/)).toBeInTheDocument();
  });

  it("resumes an unfinished day after a reload", async () => {
    const first = renderDaily();
    await screen.findByRole("region", { name: "Pair 1 of 10" });
    for (let i = 0; i < 3; i++) {
      await screen.findByRole("region", { name: `Pair ${i + 1} of 10` });
      playPair("a");
    }
    first.unmount();
    renderDaily();
    expect(await screen.findByRole("region", { name: "Pair 4 of 10" })).toBeInTheDocument();
  });

  it("shows the restocking shelf and Endless when today's file is missing", async () => {
    puzzleStatus = 404;
    renderDaily();
    expect(
      await screen.findByRole("heading", { name: "Today's shelf is being restocked" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play Endless" })).toHaveAttribute(
      "href",
      "/sticker-shock/unlimited",
    );
  });

  it("offers a retry when the shelf cannot be loaded", async () => {
    puzzleStatus = 503;
    renderDaily();
    expect(
      await screen.findByRole("heading", { name: "The shelf could not be loaded" }),
    ).toBeInTheDocument();
    puzzleStatus = 200;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Pair 1 of 10" })).toBeVisible());
  });
});
