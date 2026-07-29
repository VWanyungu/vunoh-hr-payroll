import { calculateProration } from "./proration.js";

// Jan 2024: 31 days, starts Monday, ends Wednesday -> 23 weekdays total
const periodStart = "2024-01-01";
const periodEnd = "2024-01-31";

describe("calculateProration", () => {
  it("returns the full salary for a full period with no leave or join/leave dates", () => {
    expect(
      calculateProration({ salary: 23000, periodStart, periodEnd }),
    ).toBe(23000);
  });

  it("prorates for unpaid leave days within a full period", () => {
    expect(
      calculateProration({
        salary: 23000,
        periodStart,
        periodEnd,
        unpaidLeaveDays: 3,
      }),
    ).toBe(20000);
  });

  it("prorates for a mid-period joiner", () => {
    expect(
      calculateProration({
        salary: 23000,
        periodStart,
        periodEnd,
        joinDate: "2024-01-17",
      }),
    ).toBe(11000);
  });

  it("prorates for a mid-period leaver", () => {
    expect(
      calculateProration({
        salary: 23000,
        periodStart,
        periodEnd,
        leaveDate: "2024-01-15",
      }),
    ).toBe(11000);
  });

  it("prorates for an employee who both joins and leaves within the period", () => {
    expect(
      calculateProration({
        salary: 23000,
        periodStart,
        periodEnd,
        joinDate: "2024-01-10",
        leaveDate: "2024-01-16",
      }),
    ).toBe(5000);
  });

  it("handles a join date that falls on a weekend", () => {
    expect(
      calculateProration({
        salary: 23000,
        periodStart,
        periodEnd,
        joinDate: "2024-01-06",
      }),
    ).toBe(18000);
  });

  it("combines unpaid leave days with a mid-period joiner", () => {
    expect(
      calculateProration({
        salary: 23000,
        periodStart,
        periodEnd,
        joinDate: "2024-01-17",
        unpaidLeaveDays: 2,
      }),
    ).toBe(9000);
  });

  it("clamps to 0 when unpaid leave days exceed the available window", () => {
    expect(
      calculateProration({
        salary: 23000,
        periodStart,
        periodEnd,
        joinDate: "2024-01-29",
        unpaidLeaveDays: 10,
      }),
    ).toBe(0);
  });

  it("returns 0 when the period has no weekdays", () => {
    expect(
      calculateProration({
        salary: 23000,
        periodStart: "2024-01-06",
        periodEnd: "2024-01-07",
      }),
    ).toBe(0);
  });

  it("rounds the result to 2 decimal places", () => {
    expect(
      calculateProration({
        salary: 10000,
        periodStart,
        periodEnd,
        unpaidLeaveDays: 1,
      }),
    ).toBe(9565.22);
  });
});
