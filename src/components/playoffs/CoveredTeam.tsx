import { Redacted } from "~/components/common/Redacted";

/**
 * A playoff team the viewer may not see yet: its mark and name under one
 * cover, about as wide as both.
 */
export function CoveredTeam({ className }: { className?: string }) {
  return <Redacted chars={6} className={className} />;
}
