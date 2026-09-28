// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { META_KEY, gameKey } from "@/lib/storage-keys";
import { useGame } from "./GameContext";
import { GameShell } from "./GameShell";
import { Mascot } from "./Mascot";
import { OneTapPoll } from "./OneTapPoll";
import { PLACEHOLDER_GAME, PLACEHOLDER_MASCOT_SRC } from "./placeholders";
import { ResultsScreen } from "./ResultsScreen";
import { RevealCard } from "./RevealCard";
import { ToastProvider } from "./ui/Toast";

const howTo = { lines: ["Look.", "Guess.", "Learn."] as const };

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ready: false, n: 3 }))),
  );
});

function Probe() {
  const { player, puzzle, mode } = useGame();
  return (
    <div>
      <p>mode {mode}</p>
      <p>puzzle {puzzle === null ? "none" : "set"}</p>
      <p>completed {player.stats.completed}</p>
      <button onClick={() => player.start()}>start</button>
      <button onClick={() => player.complete({ answers: ["x"], score: 3 })}>finish</button>
    </div>
  );
}

describe("GameShell", () => {
  it("shows how to play on the first visit only", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <GameShell game={PLACEHOLDER_GAME} mode="daily" howTo={howTo}>
        <Probe />
      </GameShell>,
    );
    // Meta is created by FrameProviders in the app; do it here.
    const { playerStorage } = await import("@/lib/storage");
    act(() => void playerStorage().getMeta());
    const help = await screen.findByRole("dialog", { name: "How to play" });
    expect(help).toHaveAttribute("open");
    await user.click(within(help).getByRole("button", { name: "Got it" }));
    expect(JSON.parse(window.localStorage.getItem(META_KEY) ?? "{}").howToSeen).toEqual([
      "placeholder",
    ]);
    unmount();

    render(
      <GameShell game={PLACEHOLDER_GAME} mode="daily" howTo={howTo}>
        <Probe />
      </GameShell>,
    );
    expect(screen.queryByRole("dialog", { name: "How to play" })).toBeNull();
  });

  it("gives games the puzzle number and records daily results", async () => {
    const user = userEvent.setup();
    render(
      <GameShell game={PLACEHOLDER_GAME} mode="daily" howTo={howTo}>
        <Probe />
      </GameShell>,
    );
    expect(screen.getByText("puzzle set")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "start", hidden: true }));
    await user.click(screen.getByRole("button", { name: "finish", hidden: true }));
    expect(screen.getByText("completed 1")).toBeInTheDocument();
  });

  it("keeps unlimited runs out of daily stats", async () => {
    const user = userEvent.setup();
    render(
      <GameShell game={PLACEHOLDER_GAME} mode="unlimited" howTo={howTo}>
        <Probe />
      </GameShell>,
    );
    expect(screen.getByText("puzzle none")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "finish", hidden: true }));
    expect(screen.getByText("completed 0")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(gameKey("placeholder", "unlimited"))!)).toEqual({
      bestRun: 3,
      runsPlayed: 1,
    });
  });

  it("scopes the game theme", () => {
    const { container } = render(
      <GameShell game={PLACEHOLDER_GAME} mode="daily" howTo={howTo}>
        <p>world</p>
      </GameShell>,
    );
    expect(container.querySelector('[data-game="placeholder"]')).not.toBeNull();
  });

  it("keeps the puzzle number when midnight passes and offers a reload", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
    });
    try {
      // 23:59:00 local time; the next puzzle unlocks a minute later.
      const now = new Date();
      now.setHours(23, 59, 0, 0);
      vi.setSystemTime(now);
      function PuzzleProbe() {
        const { puzzle } = useGame();
        return <p>puzzle number {puzzle}</p>;
      }
      render(
        <GameShell game={PLACEHOLDER_GAME} mode="daily" howTo={howTo}>
          <PuzzleProbe />
        </GameShell>,
      );
      const before = screen.getByText(/puzzle number/).textContent;
      expect(screen.queryByText("A new puzzle is out.")).toBeNull();
      act(() => void vi.advanceTimersByTime(2 * 60_000));
      expect(screen.getByText(/puzzle number/).textContent).toBe(before);
      expect(screen.getByRole("status", { name: "" })).toHaveTextContent("A new puzzle is out.");
      expect(screen.getByRole("button", { name: "Reload to play it" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses useGame outside a shell", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/GameShell/);
  });
});

describe("RevealCard", () => {
  it("opens with Turns out and shows the source, date and report link", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <RevealCard
          game="placeholder"
          itemId="item-1"
          statement="the fake widget costs more."
          source={{
            sourceTitle: "Example Source",
            sourceUrl: "https://example.test/source",
            checkedOn: "2026-01-15",
          }}
        >
          <p>12 vs 10</p>
        </RevealCard>
      </ToastProvider>,
    );
    expect(screen.getByText("Turns out…")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Example Source" })).toHaveAttribute(
      "href",
      "https://example.test/source",
    );
    expect(screen.getByText(/2026/)).toHaveAttribute("datetime", "2026-01-15");
    await user.click(screen.getByRole("button", { name: /Report a mistake/ }));
    // The report dialog is lazy-loaded (src/frame/lazy.ts), so it appears asynchronously.
    const dialog = await screen.findByRole(
      "dialog",
      { name: "Report a mistake" },
      { timeout: 5000 },
    );
    await user.type(within(dialog).getByLabelText("Your message"), "The date looks off.");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("report sent"));
    expect(fetch).toHaveBeenCalledWith("/api/report", expect.objectContaining({ method: "POST" }));
  });
});

describe("RevealCard with several sources", () => {
  it("lists every source with its date", () => {
    render(
      <ToastProvider>
        <RevealCard
          game="placeholder"
          itemId="item-2"
          statement="the fake gadget costs more."
          source={[
            {
              sourceTitle: "Fake Source One",
              sourceUrl: "https://example.test/one",
              checkedOn: "2026-01-15",
            },
            {
              sourceTitle: "Fake Source Two",
              sourceUrl: "https://example.test/two",
              checkedOn: "2026-02-20",
            },
          ]}
        />
      </ToastProvider>,
    );
    expect(screen.getByText(/^Sources/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fake Source One" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fake Source Two" })).toBeInTheDocument();
    expect(document.querySelectorAll("time")).toHaveLength(2);
  });
});

describe("Mascot", () => {
  it("falls back to the neutral placeholder", () => {
    render(<Mascot pose="celebrate" label="Mascot" />);
    expect(screen.getByRole("img", { name: "Mascot" })).toHaveAttribute(
      "src",
      PLACEHOLDER_MASCOT_SRC,
    );
  });
});

describe("ResultsScreen", () => {
  it("hides More from Plimp when no other game is live", () => {
    // Sticker Shock is the only live game: its own results have nothing else to offer.
    render(
      <ToastProvider>
        <ResultsScreen
          game="sticker-shock"
          score="4/5"
          streak={2}
          getShare={() => ({
            gameName: "Placeholder Game",
            slug: "placeholder",
            puzzle: 1,
            score: { value: 4, max: 5 },
            grid: "🟩",
            teaser: "Fake teaser?",
          })}
        />
      </ToastProvider>,
    );
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.queryByText("More from Plimp")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share/ })).toBeInTheDocument();
  });
});

describe("ResultsScreen with other live games", () => {
  it("offers the other live games", () => {
    render(
      <ToastProvider>
        <ResultsScreen
          game="placeholder"
          score="4/5"
          streak={1}
          getShare={() => ({
            gameName: "Placeholder Game",
            slug: "placeholder",
            puzzle: 1,
            score: { value: 4, max: 5 },
            grid: "🟩",
            teaser: "Fake teaser?",
          })}
        />
      </ToastProvider>,
    );
    expect(screen.getByRole("navigation", { name: "More from Plimp" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sticker Shock/ })).toHaveAttribute(
      "href",
      "/sticker-shock",
    );
  });
});

describe("ResultsScreen with a game-styled summary", () => {
  it("leaves the stats to the summary and shows extras and the mode label", () => {
    render(
      <ToastProvider>
        <ResultsScreen
          game="placeholder"
          score="7/10"
          streak={3}
          summaryShowsStats
          summary={<p>Fake receipt</p>}
          unlimitedHref="/"
          unlimitedLabel="Endless"
          extras={<p>Fake poll</p>}
          getShare={() => ({
            gameName: "Placeholder Game",
            slug: "placeholder",
            puzzle: 1,
            score: { value: 7, max: 10 },
            grid: "🟩",
            teaser: "Fake teaser?",
          })}
        />
      </ToastProvider>,
    );
    expect(screen.queryByText("7/10")).not.toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your result" })).toBeInTheDocument();
    expect(screen.getByText("Fake receipt")).toBeInTheDocument();
    expect(screen.getByText("Fake poll")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play Endless" })).toBeInTheDocument();
  });
});

describe("OneTapPoll", () => {
  it("records one vote and asks for results", async () => {
    const user = userEvent.setup();
    render(
      <OneTapPoll
        game="placeholder"
        pollId="placeholder:demo"
        question="Fake question?"
        options={[
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Option A" }));
    expect(screen.getByRole("button", { name: /Option A/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Option B/ })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByText("Results appear once 200 people have voted.")).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledWith("/api/vote", expect.objectContaining({ method: "POST" }));
  });
});
