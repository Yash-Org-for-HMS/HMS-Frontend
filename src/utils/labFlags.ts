/**
 * Reading a lab result against its normal range, and the critical-value rules,
 * shared by the lab's entry screen, the doctor's results and the printed report.
 * The critical rules mirror the server's evaluateCriticalValue (lab.service.ts).
 */

/** Codes made up for tests created from the rate card (SOCPARAM-..., SOCLAB-...) are internal ids, not lab codes. */
export const isInternalTestCode = (code?: string | null): boolean => !!code && /^SOC/i.test(code);

const num = (v: string) => {
  const m = (v ?? "").trim().match(/^([<>])?\s*(-?\d+(?:\.\d+)?)$/);
  return m ? { sign: m[1] as "<" | ">" | undefined, val: parseFloat(m[2]) } : null;
};

/**
 * "L" below the normal range, "H" above it, null inside it or when either side
 * is not a number. "12.0 - 16.0" style ranges only; "<5" / ">40" ranges too.
 */
export function rangeFlag(value: string | null | undefined, range: string | null | undefined): "H" | "L" | null {
  const v = num(String(value ?? ""));
  if (!v) return null;
  const r = String(range ?? "").trim();
  const between = r.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (between) {
    const lo = parseFloat(between[1]), hi = parseFloat(between[2]);
    if (v.sign === "<") return v.val <= lo ? "L" : null;
    if (v.sign === ">") return v.val >= hi ? "H" : null;
    return v.val < lo ? "L" : v.val > hi ? "H" : null;
  }
  const upTo = r.match(/^<\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (upTo) return v.val > parseFloat(upTo[1]) ? "H" : null;
  const atLeast = r.match(/^>\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (atLeast) return v.val < parseFloat(atLeast[1]) ? "L" : null;
  return null;
}

/** A numeric normal range takes a number - "abc" was saved as a white-cell count. */
export const needsNumber = (range?: string | null): boolean => /^-?\d+(\.\d+)?\s*[-–]\s*-?\d+(\.\d+)?/.test(String(range ?? "").trim());
export const isNumberResult = (value?: string | null): boolean => !!num(String(value ?? ""));

const CRITICAL_QUALITATIVE = ["reactive", "positive", "detected", "growth", "incompatible", "isolated"];
const QUALITATIVE_NEGATIONS = ["non-reactive", "nonreactive", "non reactive", "not detected", "no growth", "negative", "not isolated", "no organism"];

function analyte(testCode: string, testName?: string | null): "HB" | "PLT" | "GLU" | "K" | "WBC" | null {
  const code = (testCode || "").toUpperCase();
  if (code === "HEMO" || code === "HB" || code === "CBC-HB") return "HB";
  if (code === "PLT" || code === "PLATELETS") return "PLT";
  if (code === "GLU" || code === "FBS" || code === "RBS") return "GLU";
  if (code === "K" || code === "POTASSIUM") return "K";
  if (code === "WBC") return "WBC";
  const name = (testName || "").toLowerCase();
  if (/haemoglobin|hemoglobin|^hb\b/.test(name)) return "HB";
  if (/platelet/.test(name)) return "PLT";
  if (/potassium|serum k\b/.test(name)) return "K";
  if (/wbc|white (blood )?cell|leucocyte|leukocyte|total count/.test(name)) return "WBC";
  if (/glucose|blood sugar/.test(name)) return "GLU";
  return null;
}

export function evaluateCriticalValue(testCode: string, resultValue: string, testName?: string | null): boolean {
  const raw = (resultValue ?? "").trim();
  if (!raw || raw.toUpperCase() === "PENDING") return false;
  // Clause by clause, as the server does: a negation clears only its own finding.
  for (const clause of raw.split(/[;,\n]+|\.\s+(?=[A-Z])/).map((c) => c.trim().toLowerCase()).filter(Boolean)) {
    if (QUALITATIVE_NEGATIONS.some((n) => clause.includes(n))) continue;
    if (CRITICAL_QUALITATIVE.some((k) => clause.includes(k))) return true;
  }
  const limit = raw.match(/^([<>])\s*(-?\d+(?:\.\d+)?)/);
  const val = limit ? parseFloat(limit[2]) : parseFloat(raw);
  if (isNaN(val)) return false;
  const below = limit?.[1] === "<";
  const above = limit?.[1] === ">";
  const range = (low: number, high: number, scale = 1) => {
    const v = val * scale;
    return above ? v >= high : below ? v <= low : v < low || v > high;
  };
  switch (analyte(testCode, testName)) {
    case "HB": return range(7.0, 20.0);
    case "PLT": return range(20000, 1000000, val < 50 ? 100000 : val < 2000 ? 1000 : 1);
    case "GLU": return range(50, 400);
    case "K": return range(2.5, 6.5);
    case "WBC": return range(2000, 30000, val < 200 ? 1000 : 1);
    default: return false;
  }
}
