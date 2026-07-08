// Shared, dependency-free client-side form validation. Forms across the app are
// hand-rolled useState + MUI TextField, with errors previously only surfacing as
// post-submit server toasts. These helpers add inline validation that mirrors
// the backend rules (src/utils/validation.ts there), so the user gets immediate
// field-level feedback and a bad request never leaves the browser.
//
// Usage:
//   const errs = validate(formData, {
//     firstName: [required("First name")],
//     phone: [required("Phone"), isPhone],
//     email: [isEmail],
//     sellingPrice: [required("Price"), isNonNegativeNumber],
//   });
//   if (hasErrors(errs)) { setErrors(errs); return; }
//   ...
//   <TextField error={!!errors.phone} helperText={errors.phone || "hint"} />
//
// A rule returns "" when the value is acceptable, or a message string when not.
// Rules are run in order and the first failing rule's message wins, so put
// `required(...)` first when a field is mandatory.

export type Rule = (value: unknown) => string;
export type Rules<T> = Partial<Record<keyof T, Rule[]>>;
export type Errors<T> = Partial<Record<keyof T, string>>;

// Mirrors the backend EMAIL_REGEX and the existing Login.tsx check.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits, spaces, +, -, parentheses; 6–20 chars of content. Matches backend.
const PHONE_REGEX = /^[+]?[\d\s()-]{6,20}$/;

const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Field must be present and non-blank. */
export const required =
  (label = "This field"): Rule =>
  (v) =>
    isBlank(v) ? `${label} is required` : "";

/** Valid email format. Empty passes — combine with `required` when mandatory. */
export const isEmail: Rule = (v) =>
  isBlank(v) || EMAIL_REGEX.test(String(v).trim()) ? "" : "Enter a valid email address";

/** Valid phone format. Empty passes — combine with `required` when mandatory. */
export const isPhone: Rule = (v) =>
  isBlank(v) || PHONE_REGEX.test(String(v).trim()) ? "" : "Enter a valid phone number";

export const minLen =
  (n: number, label = "This field"): Rule =>
  (v) =>
    isBlank(v) || String(v).trim().length >= n ? "" : `${label} must be at least ${n} characters`;

export const maxLen =
  (n: number, label = "This field"): Rule =>
  (v) =>
    isBlank(v) || String(v).trim().length <= n ? "" : `${label} must be at most ${n} characters`;

/** A finite number (empty passes). */
export const isNumber: Rule = (v) =>
  isBlank(v) || Number.isFinite(Number(v)) ? "" : "Enter a valid number";

/** A finite number ≥ 0 (empty passes). Used for prices, quantities, amounts. */
export const isNonNegativeNumber: Rule = (v) => {
  if (isBlank(v)) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "Enter a valid number";
  return n >= 0 ? "" : "Value cannot be negative";
};

/** A finite number > 0 (empty passes). Used for payment/charge amounts. */
export const isPositiveNumber: Rule = (v) => {
  if (isBlank(v)) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "Enter a valid number";
  return n > 0 ? "" : "Value must be greater than zero";
};

export const min =
  (limit: number): Rule =>
  (v) => {
    if (isBlank(v)) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "Enter a valid number";
    return n >= limit ? "" : `Value must be at least ${limit}`;
  };

export const max =
  (limit: number): Rule =>
  (v) => {
    if (isBlank(v)) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "Enter a valid number";
    return n <= limit ? "" : `Value must be at most ${limit}`;
  };

/** Cross-field equality (e.g. confirm-password). */
export const match =
  (other: unknown, label = "Values"): Rule =>
  (v) =>
    v === other ? "" : `${label} do not match`;

/** Run a rule set against a values object; returns a { field: message } map of failures only. */
export function validate<T extends Record<string, unknown>>(values: T, rules: Rules<T>): Errors<T> {
  const errors: Errors<T> = {};
  (Object.keys(rules) as (keyof T)[]).forEach((field) => {
    const fieldRules = rules[field];
    if (!fieldRules) return;
    for (const rule of fieldRules) {
      const message = rule(values[field]);
      if (message) {
        errors[field] = message;
        break; // first failing rule wins
      }
    }
  });
  return errors;
}

export function hasErrors<T>(errors: Errors<T>): boolean {
  return Object.keys(errors).length > 0;
}
