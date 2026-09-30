import type { MapAnswer } from "@/engines/map/state";
import type { DailyShareInput, RunShareInput } from "@/lib/share";
import { CATEGORY_EMOJI, DAILY_MAX, SQUARES, type Band } from "./config";
import { GAME_SLUG, type Question } from "./content.schema";
import { strings } from "./strings";

/** One square per pin: 🎯 for a bullseye, then 🟩 🟨 🟧 🟥 from near to far. */
export function pinSquares(answer: Pick<MapAnswer<Band>, "pins">): string {
  return answer.pins.map((pin) => (pin.perfect ? SQUARES.perfect : SQUARES[pin.band])).join("");
}

/** A question's line: its emoji, then its squares. */
export function shareLine(
  question: Pick<Question, "category" | "shareEmoji">,
  answer?: MapAnswer<Band>,
) {
  const emoji = question.shareEmoji ?? CATEGORY_EMOJI[question.category];
  return `${emoji} ${answer ? pinSquares(answer) : ""}`.trim();
}

/** Every answer of the day, in every form a teaser could leak it. */
function spoilersFor(questions: readonly Question[]): string[] {
  return questions.flatMap((q) => [
    ...q.targets.map((t) => t.label),
    ...(q.nearest ?? []).map((n) => n.name),
  ]);
}

/**
 *   Ping #12 · 2,140/3,000
 *   🌡️ 🟨🟩🎯
 *   🌧️ 🟥🟨🟩
 *   📍 🟥🟥🟨
 *   Where was the hottest temperature ever recorded?
 *   https://plimp.lol/ping?ref=share
 */
export function dailyShare(
  day: { puzzle: number; questions: readonly Question[] },
  answers: readonly MapAnswer<Band>[],
): DailyShareInput {
  const score = answers.reduce((sum, a) => sum + a.score, 0);
  // One of today's questions, never an answer; which one rotates with the puzzle number.
  const teaser = day.questions[day.puzzle % day.questions.length]!.teaser;
  return {
    gameName: strings.name,
    slug: GAME_SLUG,
    puzzle: day.puzzle,
    score: { value: score, max: DAILY_MAX },
    grid: day.questions.map((q, i) => shareLine(q, answers[i])).join("\n"),
    teaser,
    spoilers: spoilersFor(day.questions),
  };
}

/** "Ping Practice · 2,140/3,000" and the link. */
export function practiceShare(score: string): RunShareInput {
  return {
    gameName: strings.name,
    slug: GAME_SLUG,
    run: { mode: strings.unlimited, result: score },
  };
}
