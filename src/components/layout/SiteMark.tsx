import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { FootballMark } from "~/components/score/Football";

interface SiteMarkProps {
  href: string;
  /** On a phone, where the name is hidden, read the mark as the way back. */
  back?: boolean;
}

/** The site's mark (the possession football) and name. */
export function SiteMark({ href, back = false }: SiteMarkProps) {
  return (
    <Link
      href={href}
      aria-label="Quiet Football"
      className="text-ink-muted hover:text-ink -m-2 flex shrink-0 items-center gap-2 rounded-md p-2 transition-colors"
    >
      {back && (
        <ChevronLeft className="-mr-1 size-4 shrink-0 sm:hidden" aria-hidden />
      )}
      <svg viewBox="0 0 52 32" className="h-3.5 w-6 fill-current" aria-hidden>
        <FootballMark cx={26} cy={16} radius={24} className="fill-current" />
      </svg>
      <span className="text-sm font-semibold tracking-tight">
        Quiet Football
      </span>
    </Link>
  );
}
