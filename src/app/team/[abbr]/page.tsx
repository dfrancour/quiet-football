import { type Metadata } from "next";
import { Suspense } from "react";
import { TeamApp } from "~/components/TeamApp";
import { teamPath } from "~/lib/routes";
import { TEAM_ABBREVIATIONS } from "~/lib/teams";

/** The site is exported statically, so each team's page is named up front. */
export function generateStaticParams() {
  return TEAM_ABBREVIATIONS.map((abbr) => ({ abbr }));
}

export const dynamicParams = false;

interface TeamPageProps {
  params: Promise<{ abbr: string }>;
}

export async function generateMetadata({
  params,
}: TeamPageProps): Promise<Metadata> {
  const { abbr } = await params;
  const team = abbr.toUpperCase();
  return {
    title: team,
    description: `${team}'s schedule, record and play-by-play, with no result shown until you ask.`,
    alternates: { canonical: teamPath(team) },
  };
}

/** One team's season; `?week=` opens on a game (`weekParam()`). */
export default async function TeamPage({ params }: TeamPageProps) {
  const { abbr } = await params;
  return (
    // The week comes from the query string, read on the client.
    <Suspense>
      <TeamApp abbreviation={abbr} />
    </Suspense>
  );
}
