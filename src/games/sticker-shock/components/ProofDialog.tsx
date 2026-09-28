"use client";

import { Dialog } from "@/frame/ui/Dialog";
import { formatIsoDate, formatNumber } from "@/lib/format";
import type { DayRates, PricedItem } from "../content.schema";
import { strings } from "../strings";
import { itemTitle, localPriceText } from "../text";

/** "See the shelf": the proof image, where and when it was captured, the source and licence. */
export function ProofDialog({
  open,
  onClose,
  price,
  rates,
}: {
  open: boolean;
  onClose: () => void;
  price: PricedItem;
  rates: DayRates | undefined;
}) {
  const title = itemTitle(price.item);
  const date = formatIsoDate(price.capturedOn);
  const rate = price.currency === "USD" ? undefined : rates?.usdPer[price.currency];
  return (
    <Dialog open={open} onClose={onClose} title={`${strings.proof.title}: ${title}`}>
      <figure className="flex flex-col gap-3">
        {/* Proofs are photos or screenshots of any size; next/image would need their dimensions. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={price.proofImage}
          alt={strings.proof.alt(title, price.store, price.countryName, date)}
          className="max-h-[60dvh] w-full rounded-control border border-frame-line bg-frame-line/40 object-contain"
          decoding="async"
        />
        <figcaption className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">
            {price.store}, {price.countryName}, {date}
          </p>
          <p>{localPriceText(price)}</p>
          {rate !== undefined && rates && (
            <p className="text-frame-muted">
              {strings.proof.rate(
                price.currency,
                formatNumber(rate, undefined, { maximumSignificantDigits: 6 }),
                formatIsoDate(price.fxDate),
                rates.sourceTitle,
              )}
            </p>
          )}
          {price.sample && <p className="font-semibold">{strings.proof.sampleNote}</p>}
          <p className="text-frame-muted">{strings.proof.licence[price.licence]}</p>
          <p>
            <a
              href={price.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
            >
              {strings.proof.source}
            </a>
          </p>
        </figcaption>
      </figure>
    </Dialog>
  );
}
