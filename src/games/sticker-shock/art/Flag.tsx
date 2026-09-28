import { cx } from "@/frame/ui/cx";

/**
 * A country flag from flag-icons (MIT), copied into public/ by `pnpm sticker-shock:art`. Never
 * flag emoji: Windows does not render them. Decorative: the country name is always next to it.
 */
export function Flag({ code, className }: { code: string; className?: string }) {
  return (
    // Tiny static SVGs: next/image would add client JavaScript and optimise nothing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/games/sticker-shock/flags/${code.toLowerCase()}.svg`}
      alt=""
      width={24}
      height={18}
      decoding="async"
      loading="lazy"
      draggable={false}
      className={cx("h-[18px] w-6 shrink-0 object-cover ring-1 ring-white", className)}
    />
  );
}
