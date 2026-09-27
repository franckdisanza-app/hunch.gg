"use client";

import { useState } from "react";
import { track } from "@/lib/analytics/track";
import { buildShareText, shareText, type ShareInput } from "@/lib/share";
import { strings } from "./strings";
import { Button, type ButtonProps } from "./ui/Button";
import { IconShare } from "./ui/Icons";
import { useToast } from "./ui/Toast";

export interface ShareButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Built lazily on click, so it always reflects the final result. */
  getShare: () => ShareInput;
}

export function ShareButton({ getShare, children, ...buttonProps }: ShareButtonProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    const input = getShare();
    setBusy(true);
    try {
      const outcome = await shareText(buildShareText(input));
      if (outcome === "native" || outcome === "clipboard") {
        track("share_click", { game: input.slug, method: outcome });
      }
      if (outcome === "clipboard") toast(strings.share.copied);
      if (outcome === "failed") toast(strings.share.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="primary" size="lg" disabled={busy} onClick={onClick} {...buttonProps}>
      <IconShare />
      {children ?? strings.share.button}
    </Button>
  );
}
