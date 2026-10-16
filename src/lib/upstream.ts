/**
 * The only code that calls ESPN or the recap dataset, from the browser. Both
 * answer cross-origin requests, so there is no proxy; caching and retries are
 * the query layer's (`queries.ts`).
 */

const TIMEOUT_MS = 15_000;

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

/**
 * A 4xx is the source's settled answer (a season the dataset lacks, say), so
 * asking again gains nothing; anything else may pass.
 */
export function isPermanentFailure(error: unknown): boolean {
  return (
    error instanceof UpstreamError &&
    error.status !== null &&
    error.status >= 400 &&
    error.status < 500
  );
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
    );
  }
  return response.json() as Promise<unknown>;
}
