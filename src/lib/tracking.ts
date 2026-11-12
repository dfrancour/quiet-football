/** The browser's privacy signals: Global Privacy Control and Do Not Track. */
export type PrivacySignals = {
  globalPrivacyControl?: boolean;
  doNotTrack?: string | null;
};

/** Whether the browser asks sites not to track it. */
export function asksNotToTrack(nav: PrivacySignals = navigator): boolean {
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}
