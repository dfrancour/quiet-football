import { HomeApp } from "~/components/HomeApp";
import { Supported } from "~/components/common/LoadState";

/** The league: the week's games and the standings. */
export default function HomePage() {
  return (
    <Supported>
      <HomeApp />
    </Supported>
  );
}
