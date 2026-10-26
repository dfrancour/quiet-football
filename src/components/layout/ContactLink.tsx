"use client";

import { useBrowserValue } from "~/hooks/useBrowserValue";
import { CONTACT_HOST, CONTACT_USER } from "~/lib/site";

/**
 * The "@", decoded at run time: written as a literal (or from its code point,
 * which the minifier evaluates) the halves fold into one string in the bundle.
 */
const AT = decodeURIComponent("%40");

/** An envelope, drawn inline to sit beside the GitHub mark. */
function MailMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x={2.5} y={4.5} width={19} height={15} rx={2.5} />
      <path d="m3.5 6.5 8.5 7 8.5-7" />
    </svg>
  );
}

/**
 * The site's email, assembled only in the browser. The prerendered page and
 * the first paint carry the word "Email" with nowhere to go; once hydrated
 * the link reads the address and opens the viewer's mail client. A reader
 * sees it at once, a crawler reading the HTML sees nothing to collect.
 */
export function ContactLink({ className }: { className?: string }) {
  const hydrated = useBrowserValue(
    () => true,
    () => false,
  );
  const address = hydrated ? [CONTACT_USER, CONTACT_HOST].join(AT) : null;

  return (
    <a href={address ? `mailto:${address}` : undefined} className={className}>
      <MailMark className="size-3" />
      {address ?? "Email"}
    </a>
  );
}
