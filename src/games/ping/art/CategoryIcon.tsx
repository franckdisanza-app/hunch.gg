import type { ReactNode } from "react";
import type { Category } from "../content.schema";

// Ping's category icons: one line-icon set on a 24 px grid, 2 px round strokes in currentColor.

const PATHS: Record<Category, ReactNode> = {
  heat: (
    <>
      <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z" />
      <path d="M12 9v7" />
      <path d="M18 5h2M18 9h2M18 13h1.5" />
    </>
  ),
  cold: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
      <path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.2 7.6 3.75 3.75 0 0 1 17 15H7Z" />
      <path d="M8 18.5 7 21M12.5 18.5l-1 2.5M17 18.5l-1 2.5" />
    </>
  ),
  wind: (
    <>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 12h16a3 3 0 1 1-3 3" />
      <path d="M3 16h7" />
    </>
  ),
  geography: (
    <>
      <path d="M2.5 20 9 8l4 7 2.5-4 6 9Z" />
      <path d="m7.2 12.4 1.8 1.6 1.7-1.6" />
    </>
  ),
  "furthest-from": (
    <>
      <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M8 6.2 16 13.8" />
    </>
  ),
  regional: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4.5c3-1.8 5.5 1.8 8.5 0s4.5-.6 5.5 0v8.5c-1-.6-2.5-1.8-5.5 0s-5.5-1.8-8.5 0" />
    </>
  ),
};

export function CategoryIcon({
  category,
  size = 20,
  className,
}: {
  category: Category;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[category]}
    </svg>
  );
}
