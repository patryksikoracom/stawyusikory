import { describe, expect, it } from "vitest";
import { validateExternalCalendarUrl } from "./ical-security";

describe("validateExternalCalendarUrl", () => {
  it("accepts a public HTTPS calendar", () => {
    expect(validateExternalCalendarUrl("https://example.com/calendar.ics").ok).toBe(true);
  });

  it.each([
    "http://example.com/calendar.ics",
    "https://localhost/calendar.ics",
    "https://127.0.0.1/calendar.ics",
    "https://192.168.1.20/calendar.ics",
    "https://user:password@example.com/calendar.ics",
  ])("rejects unsafe feed %s", (url) => {
    expect(validateExternalCalendarUrl(url).ok).toBe(false);
  });
});

