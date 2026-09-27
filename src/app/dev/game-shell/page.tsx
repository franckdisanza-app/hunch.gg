import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { strings } from "@/frame/strings";
import { devRoutesEnabled } from "@/lib/dev-routes";
import { EmptyGameShell } from "./EmptyGameShell";

export function generateMetadata(): Metadata {
  return {
    title: devRoutesEnabled() ? "Empty GameShell" : strings.notFound.title,
    robots: { index: false, follow: false },
  };
}

// An empty GameShell with the placeholder game. `pnpm size` measures this page's JavaScript as
// the baseline cost of any game.
export default function EmptyGameShellPage() {
  if (!devRoutesEnabled()) notFound();
  return <EmptyGameShell />;
}
