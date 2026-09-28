// Keyboard shortcuts for choice games: A or ← for the first option, B or → for the second, C for
// a third, Enter for Next. Pure mapping, so it is testable without a DOM.

export type ChoiceKeyAction = { type: "pick"; index: number } | { type: "next" };

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/** Shortcut labels per option index, for hints and aria-keyshortcuts. */
export const OPTION_KEYS = [
  { hint: "A", shortcuts: "A ArrowLeft" },
  { hint: "B", shortcuts: "B ArrowRight" },
  { hint: "C", shortcuts: "C" },
] as const;

export function keyToAction(
  input: KeyInput,
  phase: "choosing" | "revealed" | "finished",
  optionCount: number,
): ChoiceKeyAction | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  if (phase === "choosing") {
    const index =
      key === "a" || key === "ArrowLeft"
        ? 0
        : key === "b" || key === "ArrowRight"
          ? 1
          : key === "c"
            ? 2
            : -1;
    return index >= 0 && index < optionCount ? { type: "pick", index } : null;
  }
  if (phase === "revealed" && key === "Enter") return { type: "next" };
  return null;
}

/**
 * Whether a key event should be left alone: typing in a field, a modal dialog open, or Enter on a
 * control that already activates itself (a focused button or link handles Enter natively).
 */
export function shouldIgnoreKeyTarget(target: EventTarget | null, key: string): boolean {
  if (typeof document !== "undefined" && document.querySelector("dialog[open]")) return true;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (key === "Enter" && (tag === "BUTTON" || tag === "A" || tag === "SUMMARY")) return true;
  return false;
}
