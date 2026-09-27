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
    const dialog = screen.getByRole("dialog", { name: "Report a mistake" });
    await user.type(within(dialog).getByLabelText("Your message"), "The date looks off.");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("report sent"));
    expect(fetch).toHaveBeenCalledWith("/api/report", expect.objectContaining({ method: "POST" }));
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
    render(
      <ToastProvider>
        <ResultsScreen
          game="placeholder"
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
