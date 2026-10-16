import Link from "next/link";
import { FootballMark } from "~/components/score/Football";

interface SiteMarkProps {
  href: string;
}

/** The site's mark (the possession football) and name. */
export function SiteMark({ href }: SiteMarkProps) {
  return (
    <Link
      href={href}
      aria-label="Quiet Football"
      className="text-ink-muted hover:text-ink -m-1 flex shrink-0 items-center gap-2 rounded-md p-1 transition-colors"
    >
      <svg viewBox="0 0 52 32" className="h-3.5 w-6 fill-current" aria-hidden>
        <FootballMark cx={26} cy={16} radius={24} className="fill-current" />
      </svg>
      <span className="hidden text-sm font-semibold tracking-tight sm:inline">
        Quiet Football
      </span>
    </Link>
  );
}
