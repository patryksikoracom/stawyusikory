import { describe, expect, it } from "vitest";
import { addLocalDays, dateDiffDays, formatLocalDate, parseLocalDate, todayInPoland } from "./date";

describe("local dates", () => {
  it("does not shift a Polish calendar date through UTC", () => {
    expect(formatLocalDate(parseLocalDate("2026-07-13")!)).toBe("2026-07-13");
    expect(todayInPoland(new Date("2026-07-12T22:30:00.000Z"))).toBe("2026-07-13");
  });

  it("handles month and daylight-saving boundaries", () => {
    expect(addLocalDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(dateDiffDays("2026-03-28", "2026-03-30")).toBe(2);
  });
});
