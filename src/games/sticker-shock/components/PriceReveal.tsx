"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/frame/hooks";
import { RevealCard } from "@/frame/RevealCard";
import { formatIsoDate } from "@/lib/format";
import type { DayRates, PricedItem } from "../content.schema";
import type { PriceRound } from "../rounds";
import { strings } from "../strings";
import { itemTitle, localPriceText, turnsOutSentence } from "../text";
import styles from "./world.module.css";

// The proof dialog loads on first open.
const ProofDialog = dynamic(() => import("./ProofDialog").then((m) => m.ProofDialog), {
  ssr: false,
});

const GAME = "sticker-shock";

export interface PriceRevealProps {
  round: PriceRound;
  /** Crowd and report ID: the pair ID in dailies. */
  itemId: string;
  rates: Readonly<Record<string, DayRates>>;
}

/**
 * The reveal, kept short: "Turns out…" and the source line. The converted prices are on the
 * stickers; local prices (with the real pack when scaled), stores, capture dates and "See the
 * shelf" fold into "Receipts". Scrolls itself into view above the pinned action bar.
 */
export function PriceReveal({ round, itemId, rates }: PriceRevealProps) {
  const [proof, setProof] = useState<PricedItem | null>(null);
  const [a, b] = round.options;
  const statement = round.turnsOut ?? turnsOutSentence(a, b);
  const reducedMotion = usePrefersReducedMotion();
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    wrapper.current?.scrollIntoView?.({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [reducedMotion]);

  return (
    <div ref={wrapper} className={styles.revealWrap}>
      <RevealCard
        game={GAME}
        itemId={itemId}
        statement={statement}
        source={[a, b].map((p) => ({
          sourceTitle: p.licence === "ODbL" ? `${p.store} (Open Prices)` : p.store,
          sourceUrl: p.sourceUrl,
          checkedOn: p.capturedOn,
        }))}
        className={styles.coupon}
      >
        <details className={styles.details}>
          <summary>{strings.price.receipts}</summary>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
            {[a, b].map((price) => (
              <div key={price.id} className="flex min-w-0 flex-col gap-1">
                <p className="text-xs font-bold tracking-wide uppercase">
                  {itemTitle(price.item)} · {price.countryName}
                </p>
                <p className="text-sm">{localPriceText(price)}</p>
                <p className="text-xs">
                  {strings.price.captured(price.store, formatIsoDate(price.capturedOn))}
                </p>
                <button
                  type="button"
                  onClick={() => setProof(price)}
                  aria-label={strings.price.seeShelfOf(itemTitle(price.item), price.countryName)}
                  className="inline-flex min-h-11 items-center self-start font-semibold underline underline-offset-2"
                >
                  {strings.price.seeShelf}
                </button>
              </div>
            ))}
          </div>
        </details>
      </RevealCard>
      {proof && (
        <ProofDialog
          open
          onClose={() => setProof(null)}
          price={proof}
          rates={rates[proof.fxDate]}
        />
      )}
    </div>
  );
}
