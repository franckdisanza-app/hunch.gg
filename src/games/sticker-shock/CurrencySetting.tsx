"use client";

import { SegmentedControl } from "@/frame/ui/SegmentedControl";
import { DISPLAY_CURRENCIES } from "./pricing";
import { strings } from "./strings";
import { saveDisplayCurrency, useDisplayCurrency } from "./useDisplayCurrency";

/** The display currency, in the settings sheet. Cosmetic: answers are decided in US dollars. */
export function CurrencySetting() {
  const currency = useDisplayCurrency();
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label={strings.settings.currency}
        value={currency}
        options={DISPLAY_CURRENCIES.map((c) => ({ value: c, label: c }))}
        onChange={saveDisplayCurrency}
      />
      <p className="text-xs text-frame-muted">{strings.settings.currencyHint}</p>
    </div>
  );
}
