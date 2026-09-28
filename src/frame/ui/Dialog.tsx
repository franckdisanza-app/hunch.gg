"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { strings } from "../strings";
import { Button } from "./Button";
import { cx } from "./cx";
import styles from "./Dialog.module.css";
import { IconClose } from "./Icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** "sheet" rises from the bottom on phones; "dialog" is always centred. */
  variant?: "dialog" | "sheet";
  className?: string;
}

/**
 * Modal built on the native <dialog>: top layer, inert background and Esc come from the browser.
 * On top of that it keeps Tab inside the dialog, closes on a backdrop click and returns focus to
 * whatever opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  variant = "dialog",
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusTo.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Sheets are often unmounted as soon as they close, which fires no close event: still hand
  // focus back to whatever opened the dialog.
  useEffect(
    () => () => {
      const target = returnFocusTo.current;
      if (target?.isConnected) target.focus();
    },
    [],
  );

  // Fires for every way of closing: Esc, the close button, a backdrop click, or `open` turning false.
  function handleNativeClose() {
    const target = returnFocusTo.current;
    returnFocusTo.current = null;
    if (target?.isConnected) target.focus();
    if (open) onClose();
  }

  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cx(styles.dialog, variant === "sheet" && styles.sheet, className)}
      onClose={handleNativeClose}
      onKeyDown={trapTab}
      onClick={(event) => {
        // The dialog box is filled by .body, so a click whose target is the dialog itself landed
        // on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.body}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="pt-1.5 text-lg leading-tight font-bold">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label={strings.ui.close}
            onClick={onClose}
            className="-mt-1 -mr-2"
          >
            <IconClose />
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Sheet(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="sheet" />;
}
