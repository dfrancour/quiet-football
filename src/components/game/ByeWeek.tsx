/** A week the team does not play; there is nothing else to show. */
export function ByeWeek({ week }: { week: number }) {
  return (
    <section className="px-2">
      <p className="label-eyebrow">Week {week}</p>
      <p className="text-ink-muted mt-3 text-sm">Bye</p>
    </section>
  );
}
