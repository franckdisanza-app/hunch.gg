"use client";

import { useState } from "react";
import { summarizeMap, type MapAnswer } from "@/engines/map/state";
import { useGame } from "@/frame/GameContext";
import { ShareButton } from "@/frame/ShareButton";
import { prefetchJson, useJson } from "@/frame/useJson";
import { cx } from "@/frame/ui/cx";
import { formatNumber } from "@/lib/format";
import { Sonde } from "../art/Sonde";
import { DAILY_MAX, SCORING, type Band } from "../config";
import {
  GAME_SLUG,
  QUESTIONS_PER_DAY,
  practicePoolSchema,
  type DailyQuestion,
} from "../content.schema";
import { practiceShare } from "../share";
import { strings } from "../strings";
import { useDistanceUnit } from "../useDistanceUnit";
import { DraftBanner } from "./Bits";
import { Board } from "./Board";
import { BigLink, DAILY_HREF, LoadingRadar, StateScreen } from "./States";
import { Summary } from "./Summary";
import styles from "./world.module.css";

const POOL_URL = `/api/games/${GAME_SLUG}/practice`;

/** The pool, requested as soon as this module runs in the browser (before React hydrates). */
const early = prefetchJson(POOL_URL);

/** Three random past questions, each of a different category when the pool allows. */
export function pickRound(pool: readonly DailyQuestion[], random = Math.random): DailyQuestion[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const pick: DailyQuestion[] = [];
  for (const question of shuffled) {
    if (pick.some((q) => q.category === question.category)) continue;
    pick.push(question);
    if (pick.length === QUESTIONS_PER_DAY) return pick;
  }
  // Fewer categories than questions: fill up with whatever is left.
  for (const question of shuffled) {
    if (pick.length === QUESTIONS_PER_DAY) break;
    if (!pick.includes(question)) pick.push(question);
  }
  return pick;
}

/** Practice: random past questions (never today's or later). Never touches daily stats. */
export function PracticeGame() {
  const pool = useJson(POOL_URL, practicePoolSchema, early);
  const [round, setRound] = useState(0);

  if (pool.status === "loading") return <LoadingRadar title={strings.practiceHeading} />;
  if (pool.status !== "ready") {
    return (
      <StateScreen
        pose="wrong"
        title={strings.states.unavailable}
        body={strings.states.unavailableBody}
      >
        <button type="button" onClick={pool.retry} className={cx(styles.bigButton, styles.primary)}>
          {strings.states.retry}
        </button>
      </StateScreen>
    );
  }
  if (pool.data.questions.length < QUESTIONS_PER_DAY) {
    return (
      <StateScreen pose="thinking" title={strings.practiceHeading} body={strings.practice.empty}>
        <BigLink href={DAILY_HREF} variant="primary">
          {strings.practice.daily}
        </BigLink>
      </StateScreen>
    );
  }
  return (
    <PracticeRound
      key={round}
      pool={pool.data.questions}
      draft={pool.data.sample ?? false}
      onAgain={() => setRound((n) => n + 1)}
    />
  );
}

function PracticeRound({
  pool,
  draft,
  onAgain,
}: {
  pool: readonly DailyQuestion[];
  draft: boolean;
  onAgain: () => void;
}) {
  const { player } = useGame();
  const unit = useDistanceUnit();
  // Picked once per round (the pool arrives after hydration, so randomness is safe here).
  const [questions] = useState(() => pickRound(pool));
  const [over, setOver] = useState<readonly MapAnswer<Band>[] | null>(null);

  if (!over) {
    return (
      <Board
        questions={questions}
        title={strings.practiceHeading}
        draft={draft}
        onStart={() => player.start()}
        onFinish={(answers) => {
          player.complete({ answers: [], score: summarizeMap(answers, SCORING).score });
          setOver(answers);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const score = summarizeMap(over, SCORING).score;
  const result = strings.results.score(formatNumber(score), formatNumber(DAILY_MAX));
  return (
    <section className="flex flex-col items-center gap-4">
      {draft && <DraftBanner className="self-stretch" />}
      <h1 className="sr-only">{strings.practiceHeading}</h1>
      <Sonde pose={score >= DAILY_MAX * 0.66 ? "celebrate" : "point"} size={104} />
      <h2 className={cx(styles.display, "text-xl")}>{strings.practice.over}</h2>
      <p className={cx(styles.display, "text-4xl")}>{result}</p>
      <p className={cx(styles.mono, styles.muted, "text-sm")}>
        {strings.practice.best(formatNumber(Math.max(player.unlimited.bestRun, score)))}
      </p>
      <Summary questions={questions} answers={over} unit={unit} />
      <div className="flex w-full max-w-sm flex-col gap-3">
        <ShareButton getShare={() => practiceShare(result)} className="w-full" />
        <button type="button" onClick={onAgain} className={cx(styles.bigButton, styles.primary)}>
          {strings.practice.again}
        </button>
        <BigLink href={DAILY_HREF}>{strings.practice.daily}</BigLink>
      </div>
      <p className={cx(styles.muted, "text-center text-sm")}>{strings.practice.note}</p>
    </section>
  );
}
