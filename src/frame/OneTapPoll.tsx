"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/track";
import { fetchPollResults, sendVote } from "@/lib/crowd/client";
import { MIN_POLL_VOTES } from "@/lib/crowd/limits";
import type { PollResults } from "@/lib/crowd/schemas";
import { formatNumber, formatPercent } from "@/lib/format";
import { playerStorage } from "@/lib/storage";
import { usePollVotes } from "./hooks";
import { strings } from "./strings";
import { cx } from "./ui/cx";

export interface PollOption {
  /** Short ID, e.g. "a" or "left". */
  id: string;
  label: string;
}

export interface OneTapPollProps {
  game: string;
  /** Namespaced "<game>:<id>". */
  pollId: string;
  question: string;
  options: readonly [PollOption, PollOption];
  onVote?: (option: string) => void;
}

/** A question with two options. One tap votes; the crowd split appears once enough people voted. */
export function OneTapPoll({ game, pollId, question, options, onVote }: OneTapPollProps) {
  const votes = usePollVotes(game);
  const picked = votes[pollId];
  const [results, setResults] = useState<PollResults | null>(null);

  useEffect(() => {
    if (picked === undefined) return;
    let cancelled = false;
    void fetchPollResults(pollId).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [picked, pollId]);

  function vote(option: string) {
    if (picked !== undefined) return;
    playerStorage().recordPollVote(game, pollId, option);
    sendVote({ game, pollId, option });
    track("poll_vote", { poll: pollId });
    onVote?.(option);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg font-semibold">{question}</legend>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const tally = results?.ready
            ? results.options.find((o) => o.option === option.id)
            : undefined;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => vote(option.id)}
              aria-pressed={picked === option.id}
              disabled={picked !== undefined && picked !== option.id}
              className={cx(
                "relative flex min-h-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-control border-2 px-3 py-2 font-semibold transition-colors duration-fast",
                picked === option.id ? "border-current" : "border-frame-line",
                picked !== undefined && picked !== option.id && "opacity-60",
              )}
            >
              <span>{option.label}</span>
              {tally && (
                <span className="text-sm font-normal tabular">{formatPercent(tally.share)}</span>
              )}
              {picked === option.id && (
                <span className="text-xs font-normal">{strings.poll.yourPick}</span>
              )}
            </button>
          );
        })}
      </div>
      {picked !== undefined && results && (
        <p className="text-center text-sm text-frame-muted" aria-live="polite">
          {results.ready
            ? strings.poll.votes(formatNumber(results.n))
            : strings.poll.waiting(MIN_POLL_VOTES)}
        </p>
      )}
    </fieldset>
  );
}
