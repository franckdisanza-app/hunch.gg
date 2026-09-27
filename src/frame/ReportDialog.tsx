"use client";

import { useId, useState, type FormEvent } from "react";
import { track } from "@/lib/analytics/track";
import { sendReport } from "@/lib/crowd/client";
import { strings } from "./strings";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { useToast } from "./ui/Toast";

const MAX_LENGTH = 1000;

export function ReportDialog({
  open,
  onClose,
  game,
  itemId,
}: {
  open: boolean;
  onClose: () => void;
  game: string;
  itemId: string;
}) {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const fieldId = useId();
  const hintId = useId();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    const ok = await sendReport({ game, itemId, message: message.trim() });
    setSending(false);
    if (ok) {
      track("report_sent", { game, item: itemId });
      setMessage("");
    }
    onClose();
    // Toast after the dialog closes: an open modal makes the live region inert.
    toast(ok ? strings.report.sent : strings.report.failed);
  }

  return (
    <Dialog open={open} onClose={onClose} title={strings.report.title}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-frame-muted">{strings.report.intro}</p>
        <label htmlFor={fieldId} className="text-sm font-semibold">
          {strings.report.label}
        </label>
        <textarea
          id={fieldId}
          aria-describedby={hintId}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX_LENGTH}
          rows={5}
          required
          placeholder={strings.report.placeholder}
          className="w-full resize-y rounded-control border border-frame-line bg-frame-bg p-3 text-base"
        />
        <p id={hintId} className="flex justify-between text-xs text-frame-muted">
          <span>{strings.report.privacy}</span>
          <span className="tabular">
            {message.length}/{MAX_LENGTH}
          </span>
        </p>
        <Button type="submit" variant="primary" size="lg" disabled={sending || !message.trim()}>
          {sending ? strings.report.sending : strings.report.send}
        </Button>
      </form>
    </Dialog>
  );
}
