import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatDateTime,
  formatLongDate,
  formatShortDate,
  formatTime,
} from "~/lib/dates";

// Monday night in New York, already Tuesday in UTC.
const MONDAY_NIGHT = "2026-10-13T00:15:00Z";

describe("kickoff dates", () => {
  it("reads the day in the zone asked for, not the host's", () => {
    expect(formatShortDate(MONDAY_NIGHT, "America/New_York")).toBe(
      "Mon, Oct 12",
    );
    expect(formatShortDate(MONDAY_NIGHT, "UTC")).toBe("Tue, Oct 13");
    expect(formatLongDate(MONDAY_NIGHT, "America/New_York")).toBe(
      "Monday, Oct 12",
    );
    expect(formatTime(MONDAY_NIGHT, "America/New_York")).toBe("8:15 PM");
    expect(formatDateTime(MONDAY_NIGHT, "America/Los_Angeles")).toBe(
      "Mon, Oct 12, 5:15 PM",
    );
  });

  it("groups by the zone's calendar day", () => {
    expect(dayKey(MONDAY_NIGHT, "America/New_York")).not.toBe(
      dayKey(MONDAY_NIGHT, "UTC"),
    );
  });

  it("gives nothing for a date it cannot read", () => {
    expect(formatShortDate("TBD", "UTC")).toBeNull();
  });
});
