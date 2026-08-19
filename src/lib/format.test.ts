import { describe, expect, it } from "vitest";
import { daysOverdue, formatCurrency, formatDate } from "./format";

describe("formatCurrency", () => {
  it("formats KES without decimals", () => {
    const out = formatCurrency(1234.6);
    expect(out).toMatch(/1,235/);
    expect(out.toLowerCase()).toMatch(/ksh|kes/);
  });
});

describe("formatDate", () => {
  it("renders day-month-year", () => {
    expect(formatDate("2026-08-10")).toBe("10 Aug 2026");
  });
});

describe("daysOverdue", () => {
  it("returns 0 for future or today due dates", () => {
    const future = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    expect(daysOverdue(future)).toBe(0);
  });

  it("counts whole days past the due date", () => {
    const past = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
    expect(daysOverdue(past)).toBeGreaterThanOrEqual(9);
  });
});
