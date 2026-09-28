"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { RevealCard } from "@/frame/RevealCard";
import { cx } from "@/frame/ui/cx";
import { formatCurrency, formatIsoDate } from "@/lib/format";
import type { DayRates, PricedItem } from "../content.schema";
import type { DisplayCurrency } from "../pricing";
import type { PriceRound } from "../rounds";
import { displayAmount } from "../rounds";
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
  currency: DisplayCurrency;
  rates: Readonly<Record<string, DayRates>>;
}

/**
 * "Turns out…" with both prices: converted large, local small (with the real pack when scaled),
 * the store and capture date, "See the shelf" for each proof, both sources and a report link.
 */
export function PriceReveal({ round, itemId, currency, rates }: PriceRevealProps) {
  const [proof, setProof] = useState<PricedItem | null>(null);
  const [a, b] = round.options;
  const statement = round.turnsOut ?? turnsOutSentence(a, b);

  return (
    <>
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[a, b].map((price) => (
            <div key={price.id} className="flex min-w-0 flex-col gap-1">
              <p className="text-xs font-bold tracking-wide uppercase">
                {itemTitle(price.item)} · {price.countryName}
              </p>
              <p className={cx(styles.display, "text-3xl tabular")}>
                {formatCurrency(displayAmount(price, currency, rates), currency)}
              </p>
              <p className="text-sm">{localPriceText(price)}</p>
              <p className="text-xs">
                {strings.price.captured(price.store, formatIsoDate(price.capturedOn))}
              </p>
              <button
                type="button"
                onClick={() => setProof(price)}
                aria-label={strings.price.seeShelfOf(itemTitle(price.item), price.countryName)}
                className="inline-flex min-h-11 items-center gap-1 self-start font-semibold underline underline-offset-2"
              >
                {strings.price.seeShelf}
              </button>
            </div>
          ))}
        </div>
      </RevealCard>
      {proof && (
        <ProofDialog
          open
          onClose={() => setProof(null)}
          price={proof}
          rates={rates[proof.fxDate]}
        />
      )}
    </>
  );
}
