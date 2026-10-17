import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatDateTime,
  formatDayRange,
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

describe("formatDayRange", () => {
  it("names a week's days, its month once", () => {
    expect(
      formatDayRange(
        "2026-10-16T00:15:00Z",
        MONDAY_NIGHT.replace("10-13", "10-20"),
        "America/New_York",
      ),
    ).toBe("Oct 15–19");
  });

  it("names both months when the week crosses one", () => {
    expect(
      formatDayRange(
        "2026-10-30T00:15:00Z",
        "2026-11-03T01:15:00Z",
        "America/New_York",
      ),
    ).toBe("Oct 29 – Nov 2");
  });

  it("names one day once", () => {
    expect(
      formatDayRange(
        "2027-02-14T23:30:00Z",
        "2027-02-14T23:30:00Z",
        "America/New_York",
      ),
    ).toBe("Feb 14");
  });
});
