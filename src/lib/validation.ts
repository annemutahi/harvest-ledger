// Shared input validation used across forms (client-side mirror of the
// server-side rules in backend/farm_erp/validators.py).
import { z } from "zod";

/**
 * Normalise a Kenyan phone number to E.164 (+2547XXXXXXXX).
 * Accepts 07xx / 01xx / 7xx / 2547xx / +2547xx and spaces or dashes.
 * Returns null when the value cannot be normalised.
 */
export function normalizePhone(raw: string): string | null {
  const value = (raw || "").replace(/[\s\-()]/g, "");
  if (!value) return null;

  // Already international, non-Kenyan numbers are accepted as-is.
  if (/^\+(?!254)[1-9]\d{7,14}$/.test(value)) return value;

  let digits = value.replace(/^\+/, "");
  if (digits.startsWith("254")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  // Kenyan mobile (7xx / 1xx) and landline (20, 4x, 5x…) subscriber numbers.
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;
  if (/^[2-6]\d{7,8}$/.test(digits)) return `+254${digits}`;
  return null;
}

export const isValidPhone = (raw: string) => normalizePhone(raw) !== null;

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => isValidPhone(v), {
    message: "Enter a valid phone number, e.g. 0712 345 678",
  });

export const optionalPhoneSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidPhone(v), {
    message: "Enter a valid phone number, e.g. 0712 345 678",
  });

export const emailSchema = z
  .string()
  .trim()
  .max(255, "Email must be under 255 characters")
  .email("Enter a valid email address");

export const optionalEmailSchema = z
  .string()
  .trim()
  .max(255, "Email must be under 255 characters")
  .refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "Enter a valid email address",
  });

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter at least 2 characters")
  .max(120, "Must be under 120 characters");

/** Money amount: finite, non-negative, at most 2 decimal places. */
export const amountSchema = z
  .number({ invalid_type_error: "Enter a valid amount" })
  .finite("Enter a valid amount")
  .nonnegative("Amount cannot be negative")
  .max(1_000_000_000, "Amount is too large")
  .refine((v) => Number.isInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: "Use at most 2 decimal places",
  });

export const positiveAmountSchema = amountSchema.refine((v) => v > 0, {
  message: "Amount must be greater than 0",
});

export const quantitySchema = z
  .number({ invalid_type_error: "Enter a valid quantity" })
  .finite("Enter a valid quantity")
  .positive("Quantity must be greater than 0")
  .max(1_000_000, "Quantity is too large");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const dateSchema = z.string().refine(isValidDate, "Enter a valid date (YYYY-MM-DD)");

/** Dates that may not be in the future (transactions, work logs, payments). */
export const pastDateSchema = dateSchema.refine(
  (v) => new Date(`${v}T00:00:00`).getTime() <= new Date().setHours(23, 59, 59, 999),
  "Date cannot be in the future",
);

/** Business dates must not predate the system's first year of operation. */
export const businessDateSchema = pastDateSchema.refine(
  (v) => Number(v.slice(0, 4)) >= 2020,
  "Date is too far in the past",
);

export type FieldErrors = Record<string, string>;

/** Run a zod object schema and return a flat { field: message } map. */
export function validate<T extends z.ZodTypeAny>(schema: T, value: unknown): FieldErrors {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;
