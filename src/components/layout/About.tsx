import { SiteMark } from "~/components/layout/SiteMark";
import { standingsPath } from "~/lib/routes";
import { REPO_URL, SITE_NAME } from "~/lib/site";

/** The GitHub mark, drawn inline so it stays the brand's own shape. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </svg>
  );
}

/** What the site is and where its source lives. */
export function About() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex min-h-8 items-center">
        <SiteMark href={standingsPath()} />
      </header>

      <article className="text-ink-muted flex max-w-prose flex-col gap-4 text-sm leading-relaxed">
        <h1 className="text-ink text-lg font-semibold tracking-tight">About</h1>
        <p>
          {SITE_NAME} is an NFL season browser with no ads, no betting lines and
          no result shown until you ask for it. Pick a week, catch up at your
          own pace, and watch a game play by play without being told how it
          ends.
        </p>
        <p>
          It is a static site. Your browser reads ESPN&rsquo;s public scoreboard
          directly, and nothing is kept beyond your own choices, which stay in
          your browser.
        </p>
        <p className="text-ink-faint text-xs">
          {SITE_NAME} is an independent project. It is not affiliated with,
          endorsed by or sponsored by the National Football League, its teams or
          ESPN. Team names and logos belong to their respective owners.
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="text-ink-faint hover:text-ink-muted inline-flex items-center gap-1.5 self-start text-xs transition-colors"
        >
          <GitHubMark className="size-3" />
          Source on GitHub
        </a>
      </article>
    </div>
  );
}
