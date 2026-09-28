import type { ChoiceOptionStatus } from "@/engines/choice/ChoiceBoard";
import { cx } from "@/frame/ui/cx";
import { formatCurrencyParts } from "@/lib/format";
import { Flag } from "../art/Flag";
import { ItemIcon } from "../art/ItemIcon";
import { Starburst } from "../art/Starburst";
import type { PricedItem } from "../content.schema";
import type { DisplayCurrency } from "../pricing";
import { strings } from "../strings";
import { itemTitle } from "../text";
import styles from "./world.module.css";

export interface PriceCardProps {
  price: PricedItem;
  status: ChoiceOptionStatus;
  revealed: boolean;
  keyHint: string;
  /** The converted price, once revealed. */
  display: { amount: number; currency: DisplayCurrency } | null;
  /** Sticker tilt, so the two cards do not look stamped from one mould. */
  tilt: number;
}

/**
 * A shelf-edge label: red strip with the country, the item in Anton with its icon, and a yellow
 * price sticker that shows "?" until the reveal flips it. Lives inside the option's <button>.
 */
export function PriceCard({ price, status, revealed, keyHint, display, tilt }: PriceCardProps) {
  const title = itemTitle(price.item);
  const parts = display ? formatCurrencyParts(display.amount, display.currency) : null;
  const pricier = revealed && (status === "right" || status === "answer");
  const spoken = [
    `${title}, ${price.countryName}`,
    parts ? `${parts.currency} ${parts.amount}` : "",
    pricier ? strings.pricier : "",
    status === "right" ? strings.stamp.right : status === "wrong" ? strings.stamp.wrong : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true" className={styles.strip}>
        <Flag code={price.country} />
        <span className="truncate">{price.countryName}</span>
        {keyHint && <span className={styles.keyHint}>{keyHint}</span>}
      </span>
      <span aria-hidden="true" className={styles.cardBody}>
        <ItemIcon icon={price.item.icon} size={48} />
        <span className={cx(styles.display, styles.cardTitle)}>{title}</span>
        <span className={cx(styles.burst, revealed && styles.flipped)}>
          <span className={styles.burstInner}>
            <span className={styles.face}>
              <Starburst points={18} tilt={tilt} />
              <span className={cx(styles.faceText, styles.display)} style={{ fontSize: 40 }}>
                {strings.price.unknown}
              </span>
            </span>
            <span className={cx(styles.face, styles.back)}>
              <Starburst points={18} tilt={-tilt} />
              {parts && (
                <span className={cx(styles.faceText, styles.display)}>
                  <span style={{ fontSize: 13 }}>{parts.currency}</span>
                  <span
                    style={{
                      fontSize: parts.amount.length > 6 ? 17 : parts.amount.length > 5 ? 20 : 23,
                    }}
                  >
                    {parts.amount}
                  </span>
                </span>
              )}
            </span>
          </span>
        </span>
      </span>
      {revealed && (status === "right" || status === "wrong") && (
        <span
          aria-hidden="true"
          className={cx(
            styles.stamp,
            styles.display,
            status === "right" ? styles.stampRight : styles.stampWrong,
          )}
        >
          <span>{status === "right" ? "✓" : "✗"}</span>
          {status === "right" ? strings.stamp.right : strings.stamp.wrong}
        </span>
      )}
      {pricier && (
        <span aria-hidden="true" className={styles.pricier}>
          {strings.pricier}
        </span>
      )}
    </>
  );
}
