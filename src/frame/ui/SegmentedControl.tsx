"use client";

import { useId } from "react";
import { cx } from "./cx";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  className?: string;
}

/** A row of mutually exclusive options. Native radio inputs give arrow-key navigation for free. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();
  const labelId = useId();
  return (
    <fieldset role="radiogroup" aria-labelledby={labelId} className={cx("min-w-0", className)}>
      <legend id={labelId} className={cx("mb-2 text-sm font-semibold", hideLabel && "sr-only")}>
        {label}
      </legend>
      <div className="flex rounded-control border border-frame-line p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              "flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-[6px] px-3 text-sm font-medium transition-colors duration-fast",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
              option.value === value
                ? "bg-frame-ink text-frame-bg"
                : "text-frame-muted hover:text-frame-ink",
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
