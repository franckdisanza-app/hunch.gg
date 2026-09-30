"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { frameFor, type Camera } from "@/engines/map/camera";
import type { GlobeScene } from "@/engines/map/draw";
import { bboxCenter, formatDistance, type GeoPoint } from "@/engines/map/geo";
import type { GlobeHandle } from "@/engines/map/Globe";
import type { MapAnswer, MapPin, SavedMapAnswer } from "@/engines/map/state";
import { useMapGame } from "@/engines/map/useMapGame";
import { useGame } from "@/frame/GameContext";
import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import { formatNumber } from "@/lib/format";
import { Sonde } from "../art/Sonde";
import { PINS_PER_QUESTION, SCORING, TIMING, heatColor, roundFor, type Band } from "../config";
import type { DailyQuestion, Question } from "../content.schema";
import { HEAT } from "../palette";
import { SOUNDS, registerSounds } from "../sounds";
import { strings } from "../strings";
import { useDistanceUnit } from "../useDistanceUnit";
import { CategoryTag, PinsLeft } from "./Bits";
import { GlobeView } from "./GlobeView";
import { Reveal } from "./Reveal";
import styles from "./world.module.css";

/** Where the reveal is: the ring freezing and the globe flying, the sweep, then the card. */
type RevealStep = "none" | "flying" | "sweep" | "card";

export interface BoardProps {
  questions: readonly DailyQuestion[];
  title: string;
  restore?: readonly SavedMapAnswer[];
  /** After every pin: what to save so a reload can resume. */
  onProgress?(saved: SavedMapAnswer[]): void;
  /** The first pin of a fresh game. */
  onStart?(): void;
  /** A question is over (daily: the crowd guess). */
  onQuestionDone?(question: Question, answer: MapAnswer<Band>): void;
  /** Every question is over. */
  onFinish(answers: readonly MapAnswer<Band>[], saved: SavedMapAnswer[]): void;
}

/** Where the globe starts for a question: the whole world, or its scope's box. */
export function startView(question: Pick<Question, "scope">): Camera {
  const { bbox } = question.scope;
  if (!bbox) return { center: { lat: 20, lon: 10 }, zoom: 1 };
  const [west, south, east, north] = bbox;
  return frameFor([
    bboxCenter(bbox),
    { lat: south, lon: west },
    { lat: south, lon: east },
    { lat: north, lon: west },
    { lat: north, lon: east },
  ]);
}

function poseFor(step: RevealStep, pins: readonly MapPin<Band>[], solved: boolean): MascotPose {
  if (step === "card") return solved ? "celebrate" : "point";
  if (step !== "none") return "thinking";
  const last = pins.at(-1);
  if (!last) return "idle";
  if (last.band === "burning" || last.band === "hot") return "correct";
  return last.band === "warm" ? "thinking" : "wrong";
}

export function Board({
  questions,
  title,
  restore,
  onProgress,
  onStart,
  onQuestionDone,
  onFinish,
}: BoardProps) {
  const { playSound } = useGame();
  const unit = useDistanceUnit();
  const globe = useRef<GlobeHandle>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<RevealStep>("none");
  const [announcement, setAnnouncement] = useState("");
  // When each pin dropped this session started its ring (restored pins draw at once).
  const [grownAt, setGrownAt] = useState<Record<string, number>>({});

  const config = useMemo(
    () => ({ rounds: questions.map(roundFor), scoring: SCORING }),
    [questions],
  );
  const callbacks = useRef({ onProgress, onStart, onQuestionDone, onFinish });
  useEffect(() => {
    callbacks.current = { onProgress, onStart, onQuestionDone, onFinish };
  });

  const game = useMapGame({
    config,
    restore,
    onPin(pin, round, state) {
      registerSounds();
      if (state.index === 0 && state.pins.length === 1 && !restore?.length)
        callbacks.current.onStart?.();
      const key = `${round.id}-${pin.attempt}`;
      if (!game.reducedMotion) setGrownAt((g) => ({ ...g, [key]: performance.now() }));
      playSound(pin.perfect ? SOUNDS.squeak : SOUNDS.ping(pin.band));
      setAnnouncement(pinAnnouncement(pin, state.pinsLeft));
      callbacks.current.onProgress?.(game.saved());
    },
    onReveal(round, answer, state) {
      const revealed = questions.find((q) => q.id === round.id)!;
      callbacks.current.onQuestionDone?.(revealed, answer);
      startReveal(revealed, state.pins, answer);
    },
    onFinish(state) {
      callbacks.current.onFinish(state.answers, game.saved());
    },
  });

  const { state, reducedMotion, setAimElement } = game;
  const globeRef = useCallback(
    (handle: GlobeHandle | null) => {
      globe.current = handle;
      setAimElement(handle);
    },
    [setAimElement],
  );
  const question = questions[state.index]!;
  const round = config.rounds[state.index]!;
  const official = question.targets.find((t) => t.official) ?? question.targets[0]!;

  // Resumed after the last reveal but before "See results": the game is already over.
  useEffect(() => {
    if (state.phase === "finished") callbacks.current.onFinish(state.answers, game.saved());
    // Only the state the board opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The reveal, started by the round's last pin: let the ring freeze, fly to frame the answer and
  // the pins, sweep the radar over the targets (onSweepEnd), then show the card.
  const revealTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(revealTimer.current), []);

  function pinAnnouncement(pin: MapPin<Band>, pinsLeft: number): string {
    return pin.perfect
      ? strings.announce.bullseye(pin.attempt + 1)
      : strings.announce.miss(
          pin.attempt + 1,
          formatDistance(pin.km, unit),
          strings.heat[pin.band],
          strings.pins.left(pinsLeft),
        );
  }

  /** Shows the card; `before` is read out first (the last pin, when the reveal is instant). */
  function showCard(answer: MapAnswer<Band>, place: string, before?: string) {
    const reveal = strings.announce.reveal(place, formatNumber(answer.score));
    setAnnouncement(before ? `${before} ${reveal}` : reveal);
    setStep("card");
  }

  function startReveal(revealed: Question, pins: readonly MapPin<Band>[], answer: MapAnswer<Band>) {
    const target = revealed.targets.find((t) => t.official) ?? revealed.targets[0]!;
    const points: GeoPoint[] = [
      target,
      ...revealed.targets.filter((t) => t !== target),
      ...pins.map((p) => p.point),
    ];
    if (game.reducedMotion) {
      // No flight or sweep: the pin and the answer are read out together.
      globe.current?.setView(frameFor(points));
      showCard(answer, target.label, pinAnnouncement(pins.at(-1)!, 0));
      return;
    }
    setStep("flying");
    const wait = (answer.solved ? 0 : TIMING.ring) + TIMING.beforeReveal;
    revealTimer.current = window.setTimeout(() => {
      void (globe.current?.flyTo(frameFor(points)) ?? Promise.resolve()).then(() => {
        playSound(SOUNDS.sweep);
        setStep((current) => (current === "flying" ? "sweep" : current));
      });
    }, wait);
  }

  // The card: bring it into view and hand focus to Next.
  useEffect(() => {
    if (step !== "card") return;
    card.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    nextButton.current?.focus({ preventScroll: true });
  }, [step, reducedMotion]);

  function drop() {
    const point = globe.current?.aim();
    if (point && step === "none") game.drop(point);
  }

  function next() {
    const upcoming = questions[state.index + 1];
    setStep("none");
    if (upcoming) {
      const view = startView(upcoming);
      if (reducedMotion) globe.current?.setView(view);
      else void globe.current?.flyTo(view);
    }
    game.next();
    globe.current?.focus();
  }

  const scene = useMemo((): GlobeScene => {
    const showTargets = step === "sweep" || step === "card";
    return {
      pins: state.pins.map((pin, i) => ({
        id: `${round.id}-${i}`,
        point: pin.point,
        label: `${i + 1}`,
      })),
      rings: state.pins
        .filter((pin) => !pin.perfect)
        .map((pin) => {
          const id = `${round.id}-${pin.attempt}`;
          const startedAt = grownAt[id];
          return {
            id,
            center: pin.point,
            radiusKm: pin.km,
            color: heatColor(pin.km / round.scopeKm),
            label: strings.log.miss(
              formatDistance(pin.km, unit),
              strings.heat[pin.band].toUpperCase(),
            ),
            ...(startedAt !== undefined ? { startedAt } : {}),
          };
        }),
      blips: showTargets
        ? question.targets.map((t, i) => ({
            id: `${round.id}-t${i}`,
            point: t,
            official: t.official,
            color: t.official ? HEAT.hot : HEAT.mild,
          }))
        : [],
      glowCrossings: true,
      ...(showTargets ? { sweep: { key: round.id } } : {}),
    };
  }, [state.pins, round, question, step, grownAt, unit]);

  const aiming = state.phase === "aiming" && step === "none";
  const solved = state.answer?.solved ?? false;

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <Sonde pose={poseFor(step, state.pins, solved)} size={48} className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className={cx(styles.display, "text-2xl")}>{title}</h1>
          <ol aria-hidden="true" className={cx(styles.mono, "flex gap-2 text-xs")}>
            {questions.map((q, i) => {
              const answer = state.answers[i];
              return (
                <li
                  key={q.id}
                  className={cx(
                    "rounded-full border px-2 py-0.5",
                    i === state.index && state.phase !== "finished"
                      ? "border-game-accent-1 text-game-accent-1"
                      : "border-[var(--game-grid)]",
                  )}
                >
                  {answer ? formatNumber(answer.score) : `Q${i + 1}`}
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <section
        aria-labelledby={`q-${question.id}`}
        className={cx(styles.panel, "flex flex-col gap-2 p-4")}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CategoryTag question={question} />
          <PinsLeft
            left={state.phase === "aiming" ? state.pinsLeft : 0}
            total={PINS_PER_QUESTION}
          />
        </div>
        <h2 id={`q-${question.id}`} className="text-[1.0625rem] leading-snug font-semibold">
          <span className="sr-only">{strings.question(state.index + 1, questions.length)}: </span>
          {question.prompt}
        </h2>
      </section>

      <GlobeView
        globeRef={globeRef}
        scene={scene}
        initialView={startView(question)}
        interactive={aiming}
        reducedMotion={reducedMotion}
        onDrop={drop}
        onSweepEnd={() => {
          // Only the sweep this board is waiting for (an instant reveal has shown the card already).
          if (step === "sweep" && state.answer) showCard(state.answer, official.label);
        }}
      />

      {state.pins.length > 0 && step !== "card" && (
        <ol
          aria-label={strings.log.title}
          className={cx(styles.mono, "flex flex-col gap-1 text-sm")}
        >
          {state.pins.map((pin) => (
            <li key={pin.attempt} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={styles.swatch}
                style={
                  {
                    "--swatch": pin.perfect ? HEAT.hot : heatColor(pin.km / round.scopeKm),
                  } as CSSProperties
                }
              />
              <span className="font-semibold">{strings.pins.label(pin.attempt + 1)}</span>
              <span>
                {pin.perfect
                  ? strings.bullseye
                  : strings.log.miss(formatDistance(pin.km, unit), strings.heat[pin.band])}
              </span>
              <span className={cx(styles.muted, "ml-auto")}>
                {strings.log.points(formatNumber(pin.points))}
              </span>
            </li>
          ))}
        </ol>
      )}
      {state.pins.length === 0 && step === "none" && (
        <p className={cx(styles.muted, "text-center text-sm")}>{strings.dropHint}</p>
      )}

      {step === "card" && state.answer && (
        <div ref={card}>
          <Reveal question={question} answer={state.answer} unit={unit} />
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className={styles.actionBar}>
        {step === "card" ? (
          <button
            ref={nextButton}
            type="button"
            onClick={next}
            className={cx(styles.bigButton, styles.primary)}
          >
            {state.isLast ? strings.finish : strings.next}
          </button>
        ) : (
          <button
            type="button"
            onClick={drop}
            disabled={!aiming}
            aria-keyshortcuts="Enter"
            className={cx(styles.bigButton, styles.primary)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z"
                fill="currentColor"
              />
              <circle cx="12" cy="10" r="2.4" fill="var(--game-accent-1)" />
            </svg>
            {strings.drop}
          </button>
        )}
      </div>
    </div>
  );
}
