import { describe, expect, it } from "vitest";
import { toCsv, stampToday } from "./csv";

describe("toCsv", () => {
  it("serialises headers and rows", () => {
    expect(toCsv(["a", "b"], [[1, 2]])).toBe("a,b\n1,2");
  });

  it("escapes commas, quotes and newlines", () => {
    const csv = toCsv(["desc"], [['Maize, 2kg "premium"'], ["line1\nline2"]]);
    expect(csv).toBe('desc\n"Maize, 2kg ""premium"""\n"line1\nline2"');
  });

  it("renders null/undefined as empty cells", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\n,");
  });

  it("appends trailer rows after a blank line", () => {
    expect(toCsv(["a"], [[1]], [["Total", 1]])).toBe("a\n1\n\nTotal,1");
  });
});

describe("stampToday", () => {
  it("returns a YYYY-MM-DD stamp", () => {
    expect(stampToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
