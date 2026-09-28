// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo } from "react";
import { ChoiceBoard } from "./ChoiceBoard";
import type { ChoiceConfig, ChoiceRound, ChoiceState, SavedChoiceAnswer } from "./state";
import { useChoiceGame, type UseChoiceGameOptions } from "./useChoiceGame";

// A fake game with fake labels: the option with the bigger number wins.
interface FakeRound extends ChoiceRound<{ label: string; value: number }> {
  options: readonly { label: string; value: number }[];
}

const ROUNDS: FakeRound[] = [
  {
    id: "fake-1",
    options: [
      { label: "Fake A", value: 1 },
      { label: "Fake B", value: 2 },
    ],
  },
  {
    id: "fake-2",
    options: [
      { label: "Fake C", value: 9 },
      { label: "Fake D", value: 3 },
    ],
  },
];

const correctIndex = (r: FakeRound) => (r.options[0]!.value > r.options[1]!.value ? 0 : 1);

type Hooks = Pick<
  UseChoiceGameOptions<FakeRound>,
  "onPick" | "onReveal" | "onFinish" | "revealDelayMs"
>;

function FakeGame({ hooks = {}, restore }: { hooks?: Hooks; restore?: SavedChoiceAnswer[] }) {
  const config = useMemo<ChoiceConfig<FakeRound>>(
    () => ({ source: { kind: "list", rounds: ROUNDS }, correctIndex }),
    [],
  );
  const game = useChoiceGame({ config, restore, ...hooks });
  const label = (s: ChoiceState<FakeRound>) => `Round ${s.index + 1} of ${s.total}`;
  return (
    <>
      <ChoiceBoard
        game={game}
        roundLabel={label}
        renderOption={({ option, status, keyHint }) => (
          <span>
            {option.label} ({keyHint}) {status}
          </span>
        )}
        renderReveal={({ answer }) => <p>{answer.correct ? "Fake right" : "Fake wrong"}</p>}
        nextLabel={(s) => (s.isLast ? "Fake finish" : "Fake next")}
        announce={({ answer }) => (answer.correct ? "Announced right" : "Announced wrong")}
      />
      <p>phase {game.state.phase}</p>
    </>
  );
}

describe("ChoiceBoard", () => {
  it("renders the options as buttons with keyboard shortcuts", () => {
    render(<FakeGame />);
    const a = screen.getByRole("button", { name: /Fake A/ });
    expect(a).toHaveAttribute("aria-keyshortcuts", "A ArrowLeft");
    expect(screen.getByRole("button", { name: /Fake B/ })).toHaveAttribute(
      "aria-keyshortcuts",
      "B ArrowRight",
    );
    expect(screen.getByRole("region", { name: "Round 1 of 2" })).toBeInTheDocument();
  });

  it("reveals a tap, announces it and moves focus to Next", async () => {
    const user = userEvent.setup();
    const hooks = { onPick: vi.fn(), onReveal: vi.fn() };
    render(<FakeGame hooks={hooks} />);
    await user.click(screen.getByRole("button", { name: /Fake B/ }));

    expect(hooks.onPick).toHaveBeenCalledWith(ROUNDS[0], 1);
    expect(hooks.onReveal).toHaveBeenCalledWith(
      ROUNDS[0],
      { roundId: "fake-1", picked: 1, right: 1, correct: true },
      expect.objectContaining({ phase: "revealed" }),
    );
    expect(screen.getByText("Fake right")).toBeInTheDocument();
    expect(screen.getByText("Announced right")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fake B/ })).toHaveTextContent("right");
    expect(screen.getByRole("button", { name: /Fake A/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fake next" })).toHaveFocus();
  });

  it("marks the unpicked right answer after a miss", async () => {
    const user = userEvent.setup();
    render(<FakeGame />);
    await user.click(screen.getByRole("button", { name: /Fake A/ }));
    expect(screen.getByRole("button", { name: /Fake A/ })).toHaveTextContent("wrong");
    expect(screen.getByRole("button", { name: /Fake B/ })).toHaveTextContent("answer");
    expect(screen.getByText("Announced wrong")).toBeInTheDocument();
  });

  it("plays with the keyboard only: A/B to pick, Enter for next", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<FakeGame hooks={{ onFinish }} />);
    await user.keyboard("b");
    expect(screen.getByText("Fake right")).toBeInTheDocument();
    // Focus is on Next, so Enter activates it natively (and only once).
    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Round 2 of 2" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Fake finish" })).toHaveFocus();
    // Enter anywhere else also moves on.
    act(() => (document.activeElement as HTMLElement).blur());
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByText("phase finished")).toBeInTheDocument();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0].answers).toHaveLength(2);
  });

  it("ignores shortcuts while typing or while a dialog is open", () => {
    render(
      <>
        <FakeGame />
        <input aria-label="Fake field" />
      </>,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Fake field" }), { key: "a" });
    expect(screen.getByText("phase choosing")).toBeInTheDocument();

    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    fireEvent.keyDown(window, { key: "a" });
    expect(screen.getByText("phase choosing")).toBeInTheDocument();
    dialog.remove();
    fireEvent.keyDown(window, { key: "a" });
    expect(screen.getByText("phase revealed")).toBeInTheDocument();
  });

  it("waits revealDelayMs between the pick and the reveal", () => {
    vi.useFakeTimers();
    try {
      const onReveal = vi.fn();
      render(<FakeGame hooks={{ revealDelayMs: 300, onReveal }} />);
      fireEvent.click(screen.getByRole("button", { name: /Fake A/ }));
      expect(screen.getByRole("button", { name: /Fake A/ })).toHaveTextContent("pending");
      expect(onReveal).not.toHaveBeenCalled();
      // A second pick while one is pending is ignored.
      fireEvent.keyDown(window, { key: "b" });
      act(() => void vi.advanceTimersByTime(300));
      expect(onReveal).toHaveBeenCalledTimes(1);
      expect(onReveal.mock.calls[0]![1]).toMatchObject({ picked: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reveals at once when the player prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<FakeGame hooks={{ revealDelayMs: 5000 }} />);
    fireEvent.click(screen.getByRole("button", { name: /Fake A/ }));
    expect(screen.getByText("Fake wrong")).toBeInTheDocument();
  });

  it("resumes saved answers without moving focus", () => {
    render(<FakeGame restore={[{ roundId: "fake-1", picked: 0 }]} />);
    const region = screen.getByRole("region", { name: "Round 2 of 2" });
    expect(region).not.toHaveFocus();
    expect(screen.getByRole("button", { name: /Fake C/ })).toBeEnabled();
  });
});
