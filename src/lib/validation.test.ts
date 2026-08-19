import { describe, expect, it } from "vitest";
import {
  amountSchema,
  businessDateSchema,
  hasErrors,
  isValidDate,
  normalizePhone,
  optionalEmailSchema,
  pastDateSchema,
  positiveAmountSchema,
  quantitySchema,
  validate,
} from "./validation";
import { z } from "zod";

describe("normalizePhone", () => {
  it.each([
    ["0712345678", "+254712345678"],
    ["0712 345 678", "+254712345678"],
    ["+254712345678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["712345678", "+254712345678"],
    ["0110345678", "+254110345678"],
    ["020-1234567", "+254201234567"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("keeps non-Kenyan international numbers as-is", () => {
    expect(normalizePhone("+447911123456")).toBe("+447911123456");
  });

  it.each(["", "abc", "0712", "07123456789012"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("isValidDate", () => {
  it("accepts real calendar dates regardless of timezone offset", () => {
    expect(isValidDate("2026-08-10")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "10/08/2026", "2026-8-10", ""])(
    "rejects %s",
    (input) => {
      expect(isValidDate(input)).toBe(false);
    },
  );
});

describe("amounts and quantities", () => {
  it("accepts two-decimal money", () => {
    expect(amountSchema.safeParse(1250.5).success).toBe(true);
    expect(amountSchema.safeParse(0).success).toBe(true);
  });

  it("rejects negatives and >2dp", () => {
    expect(amountSchema.safeParse(-1).success).toBe(false);
    expect(amountSchema.safeParse(10.123).success).toBe(false);
  });

  it("positive amounts must exceed zero", () => {
    expect(positiveAmountSchema.safeParse(0).success).toBe(false);
    expect(positiveAmountSchema.safeParse(0.01).success).toBe(true);
  });

  it("quantities must be positive", () => {
    expect(quantitySchema.safeParse(0).success).toBe(false);
    expect(quantitySchema.safeParse(2.5).success).toBe(true);
  });
});

describe("date schemas", () => {
  const future = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const today = new Date();
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  it("allows today but not the future", () => {
    expect(pastDateSchema.safeParse(todayIso).success).toBe(true);
    expect(pastDateSchema.safeParse(future).success).toBe(false);
  });

  it("rejects pre-2020 business dates", () => {
    expect(businessDateSchema.safeParse("2019-12-31").success).toBe(false);
    expect(businessDateSchema.safeParse("2020-01-01").success).toBe(true);
  });
});

describe("optional email", () => {
  it("allows blank but not malformed", () => {
    expect(optionalEmailSchema.safeParse("").success).toBe(true);
    expect(optionalEmailSchema.safeParse("a@b.co").success).toBe(true);
    expect(optionalEmailSchema.safeParse("nope").success).toBe(false);
  });
});

describe("validate()", () => {
  const schema = z.object({ name: z.string().min(2), age: z.number().int() });

  it("returns an empty map when valid", () => {
    const errors = validate(schema, { name: "Anne", age: 3 });
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  it("flattens issues to field -> first message", () => {
    const errors = validate(schema, { name: "A", age: 1.5 });
    expect(Object.keys(errors).sort()).toEqual(["age", "name"]);
    expect(hasErrors(errors)).toBe(true);
  });
});
