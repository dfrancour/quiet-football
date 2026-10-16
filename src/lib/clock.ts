type Listener = () => void;

const TICK_MS = 1_000;

interface Subscriber {
  listener: Listener;
  everyMs: number;
  notifiedAt: number;
}

const subscribers = new Set<Subscriber>();
let snapshot: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let timerMs: number | null = null;

function tick(): void {
  snapshot = Date.now();
  // Half a tick of slack, so a tick that fires early does not skip anyone.
  const slack = (timerMs ?? TICK_MS) / 2;
  for (const subscriber of subscribers) {
    if (snapshot - subscriber.notifiedAt >= subscriber.everyMs - slack) {
      subscriber.notifiedAt = snapshot;
      subscriber.listener();
    }
  }
}

function retime(): void {
  const fastest =
    subscribers.size === 0
      ? null
      : Math.min(...[...subscribers].map(({ everyMs }) => everyMs));
  if (fastest === timerMs) return;
  if (timer !== null) clearInterval(timer);
  timer = fastest === null ? null : setInterval(tick, fastest);
  timerMs = fastest;
}

/**
 * The one shared clock, ticking each second. A finer subscriber speeds the
 * interval only while subscribed; the rest are still told once a second.
 */
export function subscribeToClock(
  listener: Listener,
  everyMs: number = TICK_MS,
): () => void {
  if (snapshot === null || timer === null) snapshot = Date.now();
  const subscriber = { listener, everyMs, notifiedAt: snapshot };
  subscribers.add(subscriber);
  retime();

  return () => {
    subscribers.delete(subscriber);
    retime();
  };
}

/** Null until the first subscription, so SSR output stays stable. */
export function getClockSnapshot(): number | null {
  return snapshot;
}

export function getServerClockSnapshot(): null {
  return null;
}
