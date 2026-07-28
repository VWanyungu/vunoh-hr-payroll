import { countWorkingDays } from "./workingDays.js";

describe("countWorkingDays", () => {
  it("counts a full Mon-Fri range with no holidays", () => {
    expect(countWorkingDays("2026-08-03", "2026-08-07", [])).toBe(5);
  });

  it("excludes weekends from a range spanning multiple weeks", () => {
    expect(countWorkingDays("2026-08-01", "2026-08-09", [])).toBe(5);
  });

  it("excludes a weekday public holiday within the range", () => {
    expect(countWorkingDays("2026-08-01", "2026-08-09", ["2026-08-04"])).toBe(4);
  });

  it("does not double-subtract a holiday that falls on a weekend", () => {
    expect(countWorkingDays("2026-08-01", "2026-08-09", ["2026-08-01"])).toBe(5);
  });

  it("counts a single weekday as 1", () => {
    expect(countWorkingDays("2026-08-03", "2026-08-03", [])).toBe(1);
  });

  it("counts a single Saturday as 0", () => {
    expect(countWorkingDays("2026-08-01", "2026-08-01", [])).toBe(0);
  });

  it("accepts Date objects as well as date strings", () => {
    const start = new Date("2026-08-03T00:00:00Z");
    const end = new Date("2026-08-07T00:00:00Z");
    expect(countWorkingDays(start, end, [])).toBe(5);
  });

  it("excludes multiple holidays across the range", () => {
    expect(
      countWorkingDays("2026-08-03", "2026-08-14", ["2026-08-04", "2026-08-12"])
    ).toBe(8);
  });
});
