import Link from "next/link";
import { strings } from "./strings";
import { Button, buttonClasses } from "./ui/Button";
import { IconBack, IconHelp, IconSettings, IconStats } from "./ui/Icons";
import { Wordmark } from "./Wordmark";

export interface TopBarProps {
  /** Inside a game: shows the back link and the game's help and stats buttons. */
  inGame?: boolean;
  onHelp?: () => void;
  onStats?: () => void;
  onSettings: () => void;
}

/** The one top bar every page shares. It never changes between games. */
export function TopBar({ inGame = false, onHelp, onStats, onSettings }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-frame-line bg-frame-bg/90 backdrop-blur supports-[backdrop-filter]:bg-frame-bg/75">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2">
        {inGame && (
          <Link
            href="/"
            aria-label={strings.topBar.back}
            className={buttonClasses("ghost", "icon")}
          >
            <IconBack />
          </Link>
        )}
        <Wordmark />
        <div className="ml-auto flex items-center gap-1">
          {inGame && onHelp && (
            <Button variant="ghost" size="icon" aria-label={strings.topBar.help} onClick={onHelp}>
              <IconHelp />
            </Button>
          )}
          {inGame && onStats && (
            <Button variant="ghost" size="icon" aria-label={strings.topBar.stats} onClick={onStats}>
              <IconStats />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={strings.topBar.settings}
            onClick={onSettings}
          >
            <IconSettings />
          </Button>
        </div>
      </div>
    </header>
  );
}
