import { SCOREBOARD_BASE } from "~/lib/season-sync";
import { STANDINGS_URL } from "~/lib/team-fetch";
import { TEAMS_PREFIX, WEEK_PREFIX } from "~/lib/week-store";

/**
 * A first visit's reads of ESPN, started from the page's head so they are
 * on the way while the script loads, rather than after it has run. The
 * inline script asks for each regular-season week and the standings that
 * no earlier visit saved (`week-store.ts`), keeping the responses under
 * `window.__prefetched` for `fetchUpstream` to take. A saved week, good or
 * not, is left to the query layer, so a return visit starts nothing here;
 * playoff rounds wait on the regular season (`queries.ts`). A read that
 * fails is asked again by the query layer, so its failure is caught here
 * rather than reported as unhandled.
 *
 * It names the season as `currentSeason()` does and the weeks as
 * `weekScoreboardUrl()` does; a test holds it to both.
 */

declare global {
  interface Window {
    __prefetched?: Map<string, Promise<Response>>;
  }
}

const REGULAR_SEASON_WEEKS = 18;

export const PREFETCH_SCRIPT = `(function(){try{
var d=new Date(),s=d.getUTCMonth()<2?d.getUTCFullYear()-1:d.getUTCFullYear();
var m=new Map();
function go(u){var p=fetch(u);p.catch(function(){});m.set(u,p);}
for(var w=1;w<=${REGULAR_SEASON_WEEKS};w++){
if(localStorage.getItem(${JSON.stringify(WEEK_PREFIX)}+s+":"+w)===null)
go(${JSON.stringify(SCOREBOARD_BASE)}+"?dates="+s+"&seasontype=2&week="+w);}
if(localStorage.getItem(${JSON.stringify(TEAMS_PREFIX)}+s)===null)
go(${JSON.stringify(STANDINGS_URL)}+"?level=3&season="+s);
window.__prefetched=m;
}catch(e){}})();`;

/** The response started for this URL from the head, if any; taken once. */
export function takePrefetched(url: string): Promise<Response> | null {
  if (typeof window === "undefined") return null;
  const pending = window.__prefetched?.get(url);
  if (!pending) return null;
  window.__prefetched?.delete(url);
  return pending;
}
