import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/dev-routes";
import { EmptyGameShell } from "./EmptyGameShell";

export const metadata: Metadata = {
  title: "Empty GameShell",
  robots: { index: false, follow: false },
};

// An empty GameShell with the placeholder game. `pnpm size` measures this page's JavaScript as
// the baseline cost of any game.
export default function EmptyGameShellPage() {
  if (!devRoutesEnabled()) notFound();
  return <EmptyGameShell />;
}
