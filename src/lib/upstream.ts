/**
 * The only code that calls ESPN or the recap dataset, from the browser. Both
 * answer cross-origin requests, so there is no proxy; caching and retries are
 * the query layer's (`queries.ts`).
 */

/** ESPN answers in well under a second when it is up; a hang is told apart quickly. */
const TIMEOUT_MS = 8_000;

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    /** How long the source asked to be left alone (`Retry-After`), if it said. */
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

/** The wait a source asked for, or null; honored for up to an hour. */
export function retryAfterOf(error: unknown): number | null {
  return error instanceof UpstreamError ? error.retryAfterMs : null;
}

const RETRY_AFTER_MAX_MS = 60 * 60_000;

/** `Retry-After` as a delay in ms: seconds, or an HTTP date. */
function readRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(header) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(ms, RETRY_AFTER_MAX_MS);
}

/**
 * A 4xx is the source's settled answer (a season the dataset lacks, say), so
 * asking again gains nothing; anything else may pass. A 429 is not settled,
 * it is a request to wait.
 */
export function isPermanentFailure(error: unknown): boolean {
  return (
    error instanceof UpstreamError &&
    error.status !== null &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  );
}

/**
 * A failure in the viewer's terms. A refused connection and a bot-block 403
 * without CORS headers both reach the browser as a bare `TypeError`.
 */
export function describeFailure(error: unknown): string {
  if (error instanceof UpstreamError) return error.message;
  // A `DOMException`, which is not an `Error` in every realm.
  if (errorName(error) === "TimeoutError")
    return "ESPN did not answer in time.";
  if (error instanceof TypeError) {
    return "ESPN could not be reached. Check your connection; a content blocker may be in the way.";
  }
  return error instanceof Error ? error.message : String(error);
}

function errorName(error: unknown): string | null {
  return typeof error === "object" && error !== null && "name" in error
    ? String(error.name)
    : null;
}

/** A JSON body, or an `UpstreamError` naming the status. */
export async function fetchUpstream(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    throw new UpstreamError(
      `${new URL(url).host} responded ${response.status}`,
      response.status,
      readRetryAfter(response.headers.get("Retry-After")),
    );
  }
  return response.json() as Promise<unknown>;
}
